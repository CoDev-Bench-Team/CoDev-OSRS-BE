import type { Transporter } from 'nodemailer';
import { User, UserRole } from '../users/entities/user.entity.js';
import { MailerService, RequestEmailContext } from './mailer.service.js';

interface SentMail {
  to?: string;
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: { cid: string }[];
}

/** The rendered HTML with tags stripped and whitespace collapsed, so copy
 * can be asserted without caring about markup or line wrapping. */
const textOf = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    // Inline tags sit mid-sentence, so they vanish; block tags become a space.
    .replace(/<\/?strong[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&copy;/g, '©')
    .replace(/&rsquo;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ');

/** The label of the red call-to-action button, or null when there is none. */
const ctaOf = (html: string) =>
  html.match(
    /<a href="[^"]*" style="[^"]*background-color: #cc2f4a[^"]*">([^<]*)<\/a>/,
  )?.[1] ?? null;

const ctaHrefOf = (html: string) =>
  html.match(/<a href="([^"]*)" style="[^"]*background-color: #cc2f4a/)?.[1] ??
  null;

const pillOf = (html: string) =>
  html.match(/border-radius: 999px;[^"]*">([^<]*)<\/span>/)?.[1] ?? null;

const context = (
  overrides: Partial<RequestEmailContext> = {},
): RequestEmailContext => ({
  requestId: 42,
  displayId: 'REQ-10482',
  submittedAt: new Date(2026, 8, 18, 9, 42),
  purpose: 'temporary project setup',
  items: [
    { itemName: 'Business Laptop - Dell Latitude', quantity: 1 },
    { itemName: 'USB-C Headset - A4Tech Hu-10', quantity: 2 },
  ],
  requesterFirstName: 'Maya',
  requesterFullName: 'Maya Santos',
  requesterOffice: 'Cebu',
  requesterEmail: 'maya@codev.com',
  ...overrides,
});

describe('MailerService', () => {
  let sent: SentMail[];
  let sendMail: ReturnType<typeof vi.fn>;
  let service: MailerService;

  const last = () => sent[sent.length - 1];

  beforeEach(() => {
    process.env.PORTAL_URL = 'https://portal.test';
    process.env.SMTP_DEFAULT_FROM = 'no-reply@codev.com';
    sent = [];
    sendMail = vi.fn(async (mail: SentMail) => {
      sent.push(mail);
    });
    service = new MailerService({ sendMail } as unknown as Transporter);
  });

  describe('every request email', () => {
    it('attaches the logo, leaves no unrendered placeholders and dates the footer', async () => {
      await service.sendRequestSubmittedEmail(context());
      await service.sendRequestNeedsApprovalEmail(context(), ['a@codev.com']);
      await service.sendRequestApprovedEmail(context());
      await service.sendRequestRejectedEmail(context(), 'No budget');
      await service.sendRequestReadyForPickupEmail(context());
      await service.sendRequestForDeliveryEmail(context());
      await service.sendRequestReceivedEmail(context());
      await service.sendRequestCompletedEmail(context());
      await service.sendRequestCancelledEmail(context(), 'Not needed', true);

      expect(sent).toHaveLength(9);
      for (const mail of sent) {
        expect(mail.attachments?.[0].cid).toBe('codev-supply-requests-logo');
        expect(mail.html).toContain('cid:codev-supply-requests-logo');
        expect(mail.html).not.toMatch(/{{|}}/);
        expect(textOf(mail.html)).toContain('© 2026 CoDev');
      }
    });

    it('swallows a delivery failure so the status change still succeeds', async () => {
      sendMail.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(
        service.sendRequestApprovedEmail(context()),
      ).resolves.toBeUndefined();
    });
  });

  describe('welcome email (Figma "Welcome email")', () => {
    it('matches the design', async () => {
      await service.sendWelcomeEmail({
        firstName: 'Maya',
        email: 'maya@codev.com',
        role: UserRole.EMPLOYEE,
      } as User);

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.to).toBe('maya@codev.com');
      expect(mail.subject).toBe('Your CoDev supply requests portal is ready');
      expect(mail.attachments?.[0].cid).toBe('codev-supply-requests-logo');
      expect(text).toContain('Welcome to CoDev supply requests');
      expect(text).toContain('Your portal is ready');
      expect(text).toContain(
        'Hi Maya — thanks for signing up. CoDev supply requests gives your team one clear place to submit, review, and track every operational request.',
      );
      expect(ctaOf(mail.html)).toBe('Get Started');
      expect(ctaHrefOf(mail.html)).toBe('https://portal.test');
      expect(text).toContain(`© ${new Date().getFullYear()} CoDev`);
      // The old design's leftovers are gone.
      expect(text).not.toContain('OSRS');
      expect(text).not.toContain('Portal URL');
    });

    it('still throws on a delivery failure, as registration expects', async () => {
      sendMail.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(
        service.sendWelcomeEmail({ firstName: 'Maya', email: 'm' } as User),
      ).rejects.toThrow('SMTP down');
    });
  });

  describe('request submitted (Figma "Request received email")', () => {
    it('matches the design', async () => {
      await service.sendRequestSubmittedEmail(context());

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.to).toBe('maya@codev.com');
      expect(mail.subject).toBe('Your request REQ-10482 has been submitted');
      expect(pillOf(mail.html)).toBe('Pending Approval');
      expect(text).toContain('Your request is in.');
      expect(text).toContain('Submitted Sep 18, 2026, 9:42AM');
      expect(text).toContain('Business Laptop - Dell Latitude');
      expect(text).toContain('Note to Approver temporary project setup');
      expect(ctaOf(mail.html)).toBe('View request');
      expect(ctaHrefOf(mail.html)).toBe('https://portal.test/requests/42');
    });

    it('drops the note block when there is no note', async () => {
      await service.sendRequestSubmittedEmail(context({ purpose: null }));

      expect(textOf(last().html)).not.toContain('Note to Approver');
    });
  });

  describe('new request needs approval (Figma "New Request awaiting approval")', () => {
    it('matches the design and BCCs every admin', async () => {
      await service.sendRequestNeedsApprovalEmail(context(), [
        'a@codev.com',
        'b@codev.com',
      ]);

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.to).toBeUndefined();
      expect(mail.bcc).toEqual(['a@codev.com', 'b@codev.com']);
      expect(mail.subject).toBe('REQ-10482 needs your approval');
      expect(pillOf(mail.html)).toBe('Pending Approval');
      expect(text).toContain('A new request needs your approval.');
      expect(text).toContain(
        'Maya Santos (Cebu) submitted a request with 2 items.',
      );
      expect(text).toContain('Requester’s Office: Cebu');
      expect(ctaOf(mail.html)).toBe('Review Request');
    });

    it('says "1 item" for a single line', async () => {
      await service.sendRequestNeedsApprovalEmail(
        context({ items: [{ itemName: 'Mouse', quantity: 3 }] }),
        ['a@codev.com'],
      );

      expect(textOf(last().html)).toContain('submitted a request with 1 item.');
    });

    it('sends nothing when there are no admins', async () => {
      await service.sendRequestNeedsApprovalEmail(context(), []);

      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('approved (Figma "Request approved email")', () => {
    it('matches the design', async () => {
      await service.sendRequestApprovedEmail(context());

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.subject).toBe('Your request REQ-10482 is approved');
      expect(pillOf(mail.html)).toBe('Approved');
      expect(text).toContain('Your equipment request is approved');
      expect(text).toContain('Good news, Maya — your request is approved.');
      expect(text).toContain('Approved Sep 18, 2026, 9:42AM');
      expect(text).toContain('Note to Approver');
      expect(ctaOf(mail.html)).toBe('View approval');
    });
  });

  describe('rejected (Figma "Request declined email")', () => {
    it('matches the design', async () => {
      await service.sendRequestRejectedEmail(
        context(),
        'Duplicate of request SR-1042',
      );

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.subject).toBe("Your request REQ-10482 wasn't approved");
      expect(pillOf(mail.html)).toBe('Rejected');
      expect(text).toContain("Your equipment request wasn't approved");
      expect(text).toContain(
        'Reason for rejection Duplicate of request SR-1042',
      );
      expect(text).not.toContain('ITEM');
      expect(ctaOf(mail.html)).toBe('Submit a new request');
      expect(ctaHrefOf(mail.html)).toBe('https://portal.test/requests');
    });
  });

  describe('ready for pickup (Figma "Status changed email")', () => {
    it('matches the design', async () => {
      await service.sendRequestReadyForPickupEmail(
        context({ previousStatus: 'approved', pickupLocation: 'Front desk' }),
      );

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.subject).toBe('Your request REQ-10482 is ready for pickup');
      expect(pillOf(mail.html)).toBe('Ready for Pickup');
      expect(text).toContain('Your request is ready for pickup');
      expect(text).toContain(
        'Admin changed the status of your request from Approved to Ready for pickup. Pickup is at Front desk, Cebu office.',
      );
      expect(text).toContain('Ready for Pickup Sep 18, 2026, 9:42AM');
      expect(ctaOf(mail.html)).toBe('View request');
    });

    it('says the location changed when it was already ready', async () => {
      await service.sendRequestReadyForPickupEmail(
        context({ previousStatus: 'ready_for_pickup' }),
      );

      expect(textOf(last().html)).toContain(
        'Admin updated where to collect your request. Pickup is at Cebu office.',
      );
    });
  });

  describe('for delivery (Figma "Status changed email")', () => {
    it('matches the design', async () => {
      await service.sendRequestForDeliveryEmail(
        context({ previousStatus: 'approved' }),
      );

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.subject).toBe('Your request REQ-10482 is now for delivery');
      expect(pillOf(mail.html)).toBe('For Delivery');
      expect(text).toContain('Your request is now for delivery');
      expect(text).toContain(
        'Admin changed the status of your request from Approved to For Delivery.',
      );
      expect(ctaOf(mail.html)).toBe('View request');
    });
  });

  describe('received (Figma "Status changed email - Received", BEN-143)', () => {
    it('matches the design and asks the requester to sign', async () => {
      await service.sendRequestReceivedEmail(
        context({ previousStatus: 'for_delivery' }),
      );

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.to).toBe('maya@codev.com');
      expect(mail.subject).toBe('Please sign for your items on REQ-10482');
      expect(pillOf(mail.html)).toBe('Received');
      expect(text).toContain('Equipment Delivered/Claimed');
      expect(text).toContain(
        "Hi Maya — this is a confirmation that IT has issued you this equipment. Before it's fully checked out to you, please review and sign the accountability form confirming you've received it.",
      );
      expect(text).toContain('Received Sep 18, 2026, 9:42AM');
      expect(text).toContain('USB-C Headset - A4Tech Hu-10');
      expect(ctaOf(mail.html)).toBe('Review &amp; sign in the portal');
      expect(ctaHrefOf(mail.html)).toBe('https://portal.test/requests/42');
    });
  });

  describe('completed (Figma "Status changed email - For completion")', () => {
    it('matches the design, with no button', async () => {
      await service.sendRequestCompletedEmail(
        context({ previousStatus: 'received' }),
      );

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.subject).toBe('Your request REQ-10482 is complete');
      expect(pillOf(mail.html)).toBe('Completed');
      expect(text).toContain('Request Completed');
      expect(text).toContain(
        'Hi Maya — this is a confirmation that your request REQ-10482 is now complete. The equipment listed below has been successfully picked up/delivered.',
      );
      expect(text).toContain('Completed Sep 18, 2026, 9:42AM');
      expect(text).toContain('Business Laptop - Dell Latitude');
      expect(ctaOf(mail.html)).toBeNull();
      expect(mail.html).not.toContain('<a href');
    });
  });

  describe('cancelled (no Figma frame)', () => {
    it('labels the reason as a cancellation, not a rejection', async () => {
      await service.sendRequestCancelledEmail(
        context({ previousStatus: 'approved' }),
        'Out of stock',
        false,
      );

      const mail = last();
      const text = textOf(mail.html);
      expect(mail.subject).toBe('Your request REQ-10482 was cancelled');
      expect(pillOf(mail.html)).toBe('Cancelled');
      expect(text).toContain('Reason for cancellation Out of stock');
      expect(text).not.toContain('Reason for rejection');
      expect(text).toContain('from Approved to Cancelled');
      expect(ctaOf(mail.html)).toBe('Submit a new request');
    });

    it('words it for the requester when they cancelled it themselves', async () => {
      await service.sendRequestCancelledEmail(
        context({ previousStatus: 'pending_approval' }),
        'Not needed',
        true,
      );

      expect(textOf(last().html)).toContain(
        'you cancelled this request (it was Pending Approval)',
      );
    });
  });
});
