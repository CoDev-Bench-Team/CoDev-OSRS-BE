import { Inject, Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Transporter } from 'nodemailer';
import { User } from '../users/entities/user.entity.js';

/**
 * The "CoDev Supply Requests" header logo, embedded as an inline (CID)
 * attachment rather than a data URI — Gmail strips base64 images, and a
 * hosted URL would need the portal to be publicly reachable. Templates
 * reference it as `cid:codev-supply-requests-logo`.
 */
const LOGO_ATTACHMENT = {
    filename: 'logo-supply-requests.png',
    path: fileURLToPath(
        new URL('./assets/logo-supply-requests.png', import.meta.url),
    ),
    cid: 'codev-supply-requests-logo',
};

const welcomeTemplate = readFile(
    new URL('./templates/welcome.hbs', import.meta.url),
    'utf8',
).then((template) => Handlebars.compile(template, { strict: true }));

const requestSubmittedTemplate = readFile(
    new URL('./templates/request-submitted.hbs', import.meta.url),
    'utf8',
).then((template) => Handlebars.compile(template, { strict: true }));

const requestNeedsApprovalTemplate = readFile(
    new URL('./templates/request-needs-approval.hbs', import.meta.url),
    'utf8',
).then((template) => Handlebars.compile(template, { strict: true }));

/** One template drives every status-change email — they differ only in copy,
 * pill colour, and which blocks are shown. */
const requestStatusChangeTemplate = readFile(
    new URL('./templates/request-status-change.hbs', import.meta.url),
    'utf8',
).then((template) => Handlebars.compile(template));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Formats as "Sep 16, 2026, 9:42AM", matching the design. */
const formatSubmittedAt = (date: Date): string => {
    const hours24 = date.getHours();
    const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const meridiem = hours24 < 12 ? 'AM' : 'PM';

    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}, ${hours}:${minutes}${meridiem}`;
};

export interface RequestEmailLine {
    itemName: string;
    quantity: number;
}

/** Everything the request emails need about the request. */
export interface RequestEmailContext {
    requestId: number;
    displayId: string;
    /** When the request was submitted — or, for status emails, when the
     * status changed. It is the date the email shows. */
    submittedAt: Date;
    purpose: string | null;
    items: RequestEmailLine[];
    requesterFirstName: string;
    requesterFullName: string;
    requesterOffice: string;
    requesterEmail: string;
    /** Only for status emails, once the request is ready for pickup. */
    pickupLocation?: string | null;
    /** Only for status emails: the status the request moved from. */
    previousStatus?: string;
}

/** How each request status reads in an email sentence. */
const STATUS_LABELS: Record<string, string> = {
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    ready_for_pickup: 'Ready for pickup',
    for_delivery: 'For Delivery',
    received: 'Received',
    rejected: 'Rejected',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

const statusLabel = (status: string | undefined, fallback: string) =>
    (status && STATUS_LABELS[status]) ?? fallback;

@Injectable()
export class MailerService {
    constructor(
        @Inject('MAIL_TRANSPORTER')
        private readonly mailerService: Transporter,
    ) {}

    async sendWelcomeEmail(user: User) {
        const renderWelcomeTemplate = await welcomeTemplate;

        await this.mailerService.sendMail({
            from: process.env.SMTP_DEFAULT_FROM,
            to: user.email,
            subject: 'Your CoDev supply requests portal is ready',
            html: renderWelcomeTemplate({
                name: user.firstName,
                portalUrl: process.env.PORTAL_URL,
                year: new Date().getFullYear(),
            }),
            attachments: [LOGO_ATTACHMENT],
        });
    }

    /** Sends the "Your request is in" email to the employee who submitted it. */
    async sendRequestSubmittedEmail(
        context: RequestEmailContext,
    ): Promise<void> {
        const renderTemplate = await requestSubmittedTemplate;

        await this.send({
            to: context.requesterEmail,
            subject: `Your request ${context.displayId} has been submitted`,
            html: renderTemplate({
                displayId: context.displayId,
                firstName: context.requesterFirstName,
                submittedAt: formatSubmittedAt(context.submittedAt),
                items: context.items,
                purpose: context.purpose,
                viewUrl: `${process.env.PORTAL_URL}/requests/${context.requestId}`,
                year: context.submittedAt.getFullYear(),
            }),
        });
    }

    /**
     * Sends the "A new request needs your approval" email to every admin.
     * Sent as a single message with the admins on BCC, so recipients don't
     * see each other's addresses.
     */
    async sendRequestNeedsApprovalEmail(
        context: RequestEmailContext,
        adminEmails: string[],
    ): Promise<void> {
        if (!adminEmails.length) {
            return;
        }

        const renderTemplate = await requestNeedsApprovalTemplate;

        await this.send({
            bcc: adminEmails,
            subject: `${context.displayId} needs your approval`,
            html: renderTemplate({
                displayId: context.displayId,
                requesterName: context.requesterFullName,
                requesterOffice: context.requesterOffice,
                itemCount: context.items.length,
                singleItem: context.items.length === 1,
                submittedAt: formatSubmittedAt(context.submittedAt),
                items: context.items,
                purpose: context.purpose,
                reviewUrl: `${process.env.PORTAL_URL}/requests/${context.requestId}`,
                year: context.submittedAt.getFullYear(),
            }),
        });
    }

    /** "Your equipment request is approved" (BEN-110). */
    async sendRequestApprovedEmail(context: RequestEmailContext): Promise<void> {
        await this.sendStatusChange(context, {
            subject: `Your request ${context.displayId} is approved`,
            pillLabel: 'Approved',
            pillBackground: '#e6f4ec',
            pillColor: '#1f7a48',
            title: 'Your equipment request is approved',
            body: `Good news, ${context.requesterFirstName} — your request is approved. We're preparing your items now, and you'll hear from us again once they're ready.`,
            dateLine: `Approved ${formatSubmittedAt(context.submittedAt)}`,
            showItems: true,
            showPurpose: true,
            ctaLabel: 'View approval',
        });
    }

    /** "Your equipment request wasn't approved" (BEN-110). Shows the reason
     * instead of the item list, and points at submitting a fresh request. */
    async sendRequestRejectedEmail(
        context: RequestEmailContext,
        reason: string,
    ): Promise<void> {
        await this.sendStatusChange(context, {
            subject: `Your request ${context.displayId} wasn't approved`,
            pillLabel: 'Rejected',
            pillBackground: '#fdecef',
            pillColor: '#cc2f4a',
            title: "Your equipment request wasn't approved",
            body: `Hi ${context.requesterFirstName} — Admin reviewed your request and wasn't able to approve it. Here's why:`,
            reason,
            reasonLabel: 'Reason for rejection',
            ctaLabel: 'Submit a new request',
            ctaUrl: `${process.env.PORTAL_URL}/requests`,
        });
    }

    /** "Your request is ready for pickup" (BEN-110). */
    async sendRequestReadyForPickupEmail(
        context: RequestEmailContext,
    ): Promise<void> {
        await this.sendStatusChange(context, {
            subject: `Your request ${context.displayId} is ready for pickup`,
            pillLabel: 'Ready for Pickup',
            pillBackground: '#e8f0fd',
            pillColor: '#1d4ed8',
            title: 'Your request is ready for pickup',
            body:
                context.previousStatus === 'ready_for_pickup'
                    ? `Hi ${context.requesterFirstName} — Admin updated where to collect your request.`
                    : `Hi ${context.requesterFirstName} — Admin changed the status of your request from ${statusLabel(context.previousStatus, 'Approved')} to Ready for pickup.`,
            pickup: context.pickupLocation
                ? `${context.pickupLocation}, ${context.requesterOffice} office`
                : `${context.requesterOffice} office`,
            dateLine: `Ready for Pickup ${formatSubmittedAt(context.submittedAt)}`,
            showItems: true,
            ctaLabel: 'View request',
        });
    }

    /** "Your request is now for delivery" (BEN-110). */
    async sendRequestForDeliveryEmail(
        context: RequestEmailContext,
    ): Promise<void> {
        await this.sendStatusChange(context, {
            subject: `Your request ${context.displayId} is now for delivery`,
            pillLabel: 'For Delivery',
            pillBackground: '#fdeaf2',
            pillColor: '#d6336c',
            title: 'Your request is now for delivery',
            body: `Hi ${context.requesterFirstName} — Admin changed the status of your request from ${statusLabel(context.previousStatus, 'Approved')} to For Delivery.`,
            dateLine: `For Delivery ${formatSubmittedAt(context.submittedAt)}`,
            showItems: true,
            ctaLabel: 'View request',
        });
    }

    /** "Equipment Delivered/Claimed", per the Figma "Status changed email -
     * Received" frame (BEN-143): sent when the request is marked received,
     * asking the requester to sign the Accountability Form. Orange pill, as
     * the design colours Received (`#ff8d28` on a 10% tint). The frame's
     * date line reads "Completed", a slip — it's the date it was received. */
    async sendRequestReceivedEmail(
        context: RequestEmailContext,
    ): Promise<void> {
        await this.sendStatusChange(context, {
            subject: `Please sign for your items on ${context.displayId}`,
            pillLabel: 'Received',
            pillBackground: '#fff4ea',
            pillColor: '#ff8d28',
            title: 'Equipment Delivered/Claimed',
            body: `Hi ${context.requesterFirstName} — this is a confirmation that IT has issued you this equipment. Before it's fully checked out to you, please review and sign the accountability form confirming you've received it.`,
            dateLine: `Received ${formatSubmittedAt(context.submittedAt)}`,
            showItems: true,
            ctaLabel: 'Review & sign in the portal',
        });
    }

    /** "Request Completed", per the Figma "Status changed email - For
     * completion" frame: sent when the requester signs the Accountability
     * Form (BEN-143). The design has no button: the request is closed. */
    async sendRequestCompletedEmail(
        context: RequestEmailContext,
    ): Promise<void> {
        await this.sendStatusChange(context, {
            subject: `Your request ${context.displayId} is complete`,
            pillLabel: 'Completed',
            pillBackground: '#f1ebfb',
            pillColor: '#6b3fc4',
            title: 'Request Completed',
            body: `Hi ${context.requesterFirstName} — this is a confirmation that your request ${context.displayId} is now complete. The equipment listed below has been successfully picked up/delivered.`,
            dateLine: `Completed ${formatSubmittedAt(context.submittedAt)}`,
            showItems: true,
        });
    }

    /** "Your request was cancelled" (FR-014). Slate pill, as the design
     * colours Cancelled; shows the reason, like a rejection. */
    async sendRequestCancelledEmail(
        context: RequestEmailContext,
        reason: string,
        cancelledByRequester: boolean,
    ): Promise<void> {
        await this.sendStatusChange(context, {
            subject: `Your request ${context.displayId} was cancelled`,
            pillLabel: 'Cancelled',
            pillBackground: '#eef0f3',
            pillColor: '#5b6270',
            title: 'Your request was cancelled',
            body: cancelledByRequester
                ? `Hi ${context.requesterFirstName} — you cancelled this request (it was ${statusLabel(context.previousStatus, 'Pending Approval')}), and the items it held have been released. Your reason:`
                : `Hi ${context.requesterFirstName} — Admin changed the status of your request from ${statusLabel(context.previousStatus, 'Approved')} to Cancelled because it can't be fulfilled. Here's why:`,
            reason,
            reasonLabel: 'Reason for cancellation',
            ctaLabel: 'Submit a new request',
            ctaUrl: `${process.env.PORTAL_URL}/requests`,
        });
    }

    private async sendStatusChange(
        context: RequestEmailContext,
        variant: {
            subject: string;
            pillLabel: string;
            pillBackground: string;
            pillColor: string;
            title: string;
            body: string;
            pickup?: string;
            reason?: string;
            reasonLabel?: string;
            dateLine?: string;
            showItems?: boolean;
            showPurpose?: boolean;
            /** Omit for an email with no button. */
            ctaLabel?: string;
            ctaUrl?: string;
        },
    ): Promise<void> {
        const renderTemplate = await requestStatusChangeTemplate;

        await this.send({
            to: context.requesterEmail,
            subject: variant.subject,
            html: renderTemplate({
                displayId: context.displayId,
                pillLabel: variant.pillLabel,
                pillBackground: variant.pillBackground,
                pillColor: variant.pillColor,
                title: variant.title,
                body: variant.body,
                pickup: variant.pickup,
                reason: variant.reason,
                reasonLabel: variant.reasonLabel,
                dateLine: variant.dateLine,
                items: variant.showItems ? context.items : null,
                purpose: variant.showPurpose ? context.purpose : null,
                ctaLabel: variant.ctaLabel,
                ctaUrl:
                    variant.ctaUrl ??
                    `${process.env.PORTAL_URL}/requests/${context.requestId}`,
                year: context.submittedAt.getFullYear(),
            }),
        });
    }

    /**
     * Best-effort delivery: a failure is swallowed rather than thrown, so it
     * never rolls back an already-valid submit. Failures aren't persisted for
     * MVP (see PR #79 review) — an outbox-based retry is planned later.
     */
    private async send(options: {
        to?: string;
        bcc?: string[];
        subject: string;
        html: string;
    }): Promise<void> {
        try {
            await this.mailerService.sendMail({
                from: process.env.SMTP_DEFAULT_FROM,
                ...options,
                attachments: [LOGO_ATTACHMENT],
            });
        } catch {
            // Intentionally ignored — see above.
        }
    }
}
