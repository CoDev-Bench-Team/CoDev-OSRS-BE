import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { Request, RequestStatus, TimelineEvent } from './entities/request.entity.js';
import { RequestAsset } from './entities/request-asset.entity.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { Asset, AssetLocation } from '../assets/entities/asset.entity.js';
import {
  InventoryItem,
  InventoryItemStatus,
} from '../inventory-items/entities/inventory-item.entity.js';
import {
  MailerService,
  RequestEmailContext,
  RequestEmailLine,
} from '../mailer/mailer.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateRequestDto } from './dto/update-request.dto.js';
import { CancelRequestDto } from './dto/cancel-request.dto.js';
import { SignRequestDto } from './dto/sign-request.dto.js';
import {
  PaginatedRequestsQueryDto,
  RequestSortOrder,
} from './dto/paginated-requests-query.dto.js';
import {
  PaginatedRequestHistoryQueryDto,
  RESOLVED_STATUSES,
} from './dto/paginated-request-history-query.dto.js';
import {
  IN_PROCESSING_STATUSES,
  RequestCounts,
  RequestCountsQueryDto,
} from './dto/request-counts.dto.js';
import { PaginatedResult } from '../common/paginated-result.js';

const RELATIONS = {
  requestor: true,
  reviewedBy: true,
  cancelledBy: true,
  items: { asset: true },
};

/** Which statuses a request may be moved *from* for each target status
 * (BEN-110). Anything else is rejected as an illegal transition. */
const LEGAL_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.PENDING_APPROVAL]: [],
  [RequestStatus.APPROVED]: [RequestStatus.PENDING_APPROVAL],
  [RequestStatus.REJECTED]: [RequestStatus.PENDING_APPROVAL],
  // The two handover states are peers, not a sequence (FR-011): an approved
  // request goes to either, and can switch between them. Ready for pickup
  // may be set again to correct the pickup location; re-setting for
  // delivery would change nothing, so it isn't allowed.
  [RequestStatus.READY_FOR_PICKUP]: [
    RequestStatus.APPROVED,
    RequestStatus.FOR_DELIVERY,
    RequestStatus.READY_FOR_PICKUP,
  ],
  [RequestStatus.FOR_DELIVERY]: [
    RequestStatus.APPROVED,
    RequestStatus.READY_FOR_PICKUP,
  ],
  // Received and Completed are never set through `update()` (BEN-143):
  // Received only through `receive()`, which the requester can call too, and
  // Completed only through `sign()`, when the requester signs the
  // Accountability Form.
  [RequestStatus.RECEIVED]: [],
  [RequestStatus.COMPLETED]: [],
  // Only through `cancel()`, which has its own per-role rules.
  [RequestStatus.CANCELLED]: [],
};

/** Statuses a request may be marked Received from (BEN-143). */
const RECEIVABLE = [RequestStatus.FOR_DELIVERY, RequestStatus.READY_FOR_PICKUP];

/** Statuses an employee may cancel their own request from (FR-010a). */
const EMPLOYEE_CANCELLABLE = [RequestStatus.PENDING_APPROVAL];

/** Statuses an admin may cancel a request from (FR-010b) — after approval
 * only; a pending request is rejected instead. */
const ADMIN_CANCELLABLE = [
  RequestStatus.APPROVED,
  RequestStatus.READY_FOR_PICKUP,
  RequestStatus.FOR_DELIVERY,
];

/** A unit a request holds, as the Accountability Form lists it. */
export interface RequestUnit {
  id: number;
  assetId: number;
  serialNumber: string | null;
  status: InventoryItemStatus;
}

/** A request's lines as the emails list them: "Name - Model", as the design
 * shows them (e.g. "Business Laptop - Dell Latitude"). */
const emailLines = (request: Request): RequestEmailLine[] =>
  request.items.map((item) => ({
    itemName: [item.asset.name, item.asset.model].filter(Boolean).join(' - '),
    quantity: item.quantity,
  }));

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly requestsRepository: Repository<Request>,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Lists requests for the Admin's Requests Queue, or — when `viewer` is an
   * employee — only that employee's own requests (My Requests, FR-016).
   */
  paginate(
    query: PaginatedRequestsQueryDto,
    viewer: User,
  ): Promise<PaginatedResult<Request>> {
    return this.paginateRequests(query, viewer, { dateColumn: 'createdAt' });
  }

  /**
   * Lists resolved requests — completed, rejected or cancelled — for the
   * admin History (FR-016a), newest resolution first by default.
   */
  history(
    query: PaginatedRequestHistoryQueryDto,
    viewer: User,
  ): Promise<PaginatedResult<Request>> {
    return this.paginateRequests(query, viewer, {
      statuses: [...RESOLVED_STATUSES],
      dateColumn: 'resolvedAt',
    });
  }

  /**
   * Counts requests per status for the queue's filter chips and summary
   * cards (FR-016), under the same viewer scoping and search filters as the
   * list (the `status` filter itself is ignored, so every chip gets a count).
   */
  async counts(
    query: RequestCountsQueryDto,
    viewer: User,
  ): Promise<RequestCounts> {
    const rows = await this.filteredQuery(query, viewer)
      .select('request.status', 'status')
      .addSelect('COUNT(request.id)', 'count')
      .groupBy('request.status')
      .getRawMany<{ status: RequestStatus; count: string }>();

    const byStatus = Object.fromEntries(
      Object.values(RequestStatus).map((s) => [s, 0]),
    ) as Record<RequestStatus, number>;
    for (const { status, count } of rows) {
      byStatus[status] = Number(count);
    }

    return {
      total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
      byStatus,
      inProcessing: IN_PROCESSING_STATUSES.reduce(
        (sum, s) => sum + byStatus[s],
        0,
      ),
    };
  }

  /**
   * The list's WHERE clause: viewer scoping (employees see only their own),
   * an optional status whitelist, and the search filters.
   *
   * Filters on a query with no to-many join, so `skip`/`take` apply
   * correctly. `itemName` needs the `items` -> `assets` join, which would
   * fan out rows (breaking pagination) if done here — pushed into a subquery
   * instead. `requestor` uses `leftJoinAndSelect` (not just `leftJoin`) even
   * though only its columns are needed for filtering: TypeORM wraps any join
   * + skip/take combination in an outer `SELECT DISTINCT` subquery, and that
   * outer query can only reference columns the inner one actually selected
   * — so ordering by a joined column (the employee-name sort) needs it
   * selected, not just joined. Safe here since `requestor` is ManyToOne — no
   * fan-out risk.
   */
  private filteredQuery(
    query: Pick<
      PaginatedRequestsQueryDto,
      'status' | 'displayId' | 'requester' | 'requesterId' | 'itemName'
    >,
    viewer: User,
    statuses?: RequestStatus[],
  ): SelectQueryBuilder<Request> {
    const { status, displayId, requester, requesterId, itemName } = query;
    const filtered = this.requestsRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.requestor', 'requestor');

    if (viewer.role !== UserRole.ADMIN) {
      filtered.andWhere('requestor.id = :viewerId', { viewerId: viewer.id });
    }
    if (statuses) {
      filtered.andWhere('request.status IN (:...scopeStatuses)', {
        scopeStatuses: statuses,
      });
    }
    if (status) {
      filtered.andWhere('request.status = :status', { status });
    }
    if (displayId) {
      filtered.andWhere('request.displayId ILIKE :displayId', {
        displayId: `%${displayId}%`,
      });
    }
    if (requester) {
      filtered.andWhere(
        '(requestor.firstName ILIKE :requester OR requestor.lastName ILIKE :requester OR requestor.email ILIKE :requester)',
        { requester: `%${requester}%` },
      );
    }
    if (requesterId !== undefined) {
      filtered.andWhere('requestor.id = :requesterId', { requesterId });
    }
    if (itemName) {
      filtered.andWhere(
        `request.id IN (SELECT ra."request_id" FROM request_assets ra INNER JOIN assets a ON a.id = ra."asset_id" WHERE a.name ILIKE :itemName)`,
        { itemName: `%${itemName}%` },
      );
    }

    return filtered;
  }

  /**
   * Shared by the queue and History: `scope.statuses` limits which statuses
   * can appear at all, and `scope.dateColumn` is what the newest / oldest
   * sorts order by.
   */
  private async paginateRequests(
    query: PaginatedRequestsQueryDto,
    viewer: User,
    scope: {
      statuses?: RequestStatus[];
      dateColumn: 'createdAt' | 'resolvedAt';
    },
  ): Promise<PaginatedResult<Request>> {
    const { page = 1, limit = 10, sort = RequestSortOrder.NEWEST } = query;
    const buildFilteredQuery = () =>
      this.filteredQuery(query, viewer, scope.statuses);

    // `getManyAndCount()` is avoided here: TypeORM's automatic count-query
    // derivation drops joins that are only referenced by `orderBy` (not
    // `where`), which breaks with a "column does not exist" error once
    // `orderBy` references the joined `requestor` table (the employee-name
    // sort). Counting on a query with no `orderBy` at all sidesteps that.
    const total = await buildFilteredQuery().getCount();

    const idQuery = buildFilteredQuery();
    if (sort === RequestSortOrder.EMPLOYEE_NAME_ASC) {
      idQuery
        .orderBy('requestor.firstName', 'ASC')
        .addOrderBy('requestor.lastName', 'ASC');
    } else {
      idQuery
        .orderBy(
          `request.${scope.dateColumn}`,
          sort === RequestSortOrder.OLDEST ? 'ASC' : 'DESC',
        )
        // Ties (and History rows resolved in the same instant) stay in a
        // stable order across pages.
        .addOrderBy('request.id', sort === RequestSortOrder.OLDEST ? 'ASC' : 'DESC');
    }
    idQuery.skip((page - 1) * limit).take(limit);

    const pageOfRequests = await idQuery.getMany();

    // Re-fetch this page's requests with the full relation graph — can't
    // eager-load `items`/`asset` on the query above without risking the
    // pagination fan-out bug. `find()` with `id: In(...)` doesn't preserve
    // order, so the already-correctly-sorted ids from the query above are
    // used to reorder the result instead of re-sorting (which would only
    // be right for the createdAt sorts, not employee name).
    const orderedIds = pageOfRequests.map((r) => r.id);
    const data = orderedIds.length
      ? await this.requestsRepository.find({
          where: { id: In(orderedIds) },
          relations: RELATIONS,
        })
      : [];
    const dataById = new Map(data.map((r) => [r.id, r]));
    const orderedData = orderedIds
      .map((id) => dataById.get(id))
      .filter((r): r is Request => r !== undefined);

    return {
      data: await this.attachAvailableStock(orderedData),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Fetches one request. With a non-admin `viewer`, someone else's request is
   * reported as not found rather than forbidden, so employees can't probe
   * which request IDs exist. Internal callers omit `viewer`.
   */
  async find(id: number, viewer?: User): Promise<Request> {
    const request = await this.requestsRepository.findOne({
      where: { id },
      relations: RELATIONS,
    });
    if (
      !request ||
      (viewer &&
        viewer.role !== UserRole.ADMIN &&
        request.requestor.id !== viewer.id)
    ) {
      throw new NotFoundException(
        `Request with ID '${id}' could not be found.`,
      );
    }

    const [requestWithStock] = await this.attachAvailableStock([request]);
    return this.attachUnits(requestWithStock);
  }

  /**
   * Attaches the units the request holds — reserved, or assigned once
   * received — so the Accountability Form can list each one's serial
   * number (BEN-143). Only identifying fields are selected: never the
   * recovery PIN or BitLocker identifier.
   */
  private async attachUnits(request: Request): Promise<Request> {
    const units = await this.requestsRepository.manager
      .createQueryBuilder(InventoryItem, 'inventory')
      .select('inventory.id', 'id')
      .addSelect('inventory.asset_id', 'assetId')
      .addSelect('inventory.serial_number', 'serialNumber')
      .addSelect('inventory.status', 'status')
      .where('inventory.request_id = :requestId', { requestId: request.id })
      .andWhere('inventory.status IN (:...statuses)', {
        statuses: [InventoryItemStatus.RESERVED, InventoryItemStatus.ASSIGNED],
      })
      .orderBy('inventory.id', 'ASC')
      .getRawMany<RequestUnit>();

    return Object.assign(request, { units });
  }

  async create(
    createRequestDto: CreateRequestDto,
    requestor: User,
  ): Promise<Request> {
    const assetIds = createRequestDto.items.map((item) => item.assetId);
    if (new Set(assetIds).size !== assetIds.length) {
      throw new BadRequestException(
        'Each asset may only appear once per request.',
      );
    }

    // Stock is held per office, and an employee requests from their own
    // office only (FR-006; the MVP doesn't request another office's stock).
    // A home office outside the known offices fails closed.
    const office = Object.values(AssetLocation).find(
      (location) => location === String(requestor.location),
    );
    if (!office) {
      throw new BadRequestException(
        `Your account's office ('${requestor.location}') isn't one we hold stock at; ask an admin to update it.`,
      );
    }

    // Validates every line, reserves stock, and creates the request (plus
    // its RequestAsset lines, via cascade) in one atomic transaction: either
    // all lines succeed and stock is decremented for each, or nothing is
    // created and nothing is reserved (FR-005/006). Reservation locks the
    // InventoryItem rows being claimed (`FOR UPDATE`, in a stable id order)
    // so concurrent submits for the last unit can't both succeed (ADR-0002).
    const savedRequest = await this.requestsRepository.manager.transaction(
      async (manager) => {
        const requestItems: RequestAsset[] = [];
        const reservedUnitIds: number[] = [];

        for (const line of createRequestDto.items) {
          const asset = await manager.findOneBy(Asset, { id: line.assetId });
          if (!asset) {
            throw new BadRequestException(
              `Asset with ID '${line.assetId}' could not be found.`,
            );
          }
          const availableUnits = await manager
            .createQueryBuilder(InventoryItem, 'inventory')
            .setLock('pessimistic_write')
            .where('inventory.asset_id = :assetId', { assetId: asset.id })
            .andWhere('inventory.location = :office', { office })
            .andWhere('inventory.status = :status', {
              status: InventoryItemStatus.AVAILABLE,
            })
            .orderBy('inventory.id', 'ASC')
            .take(line.quantity)
            .getMany();

          if (availableUnits.length < line.quantity) {
            throw new BadRequestException(
              `Insufficient stock for '${asset.name}' at ${office}: requested ${line.quantity}, ${availableUnits.length} available.`,
            );
          }

          // Reserved below, once the request row exists to link them to.
          reservedUnitIds.push(...availableUnits.map((unit) => unit.id));

          requestItems.push(
            manager.create(RequestAsset, { asset, quantity: line.quantity }),
          );
        }

        const initialEvent: TimelineEvent = {
          status: RequestStatus.PENDING_APPROVAL,
          at: new Date().toISOString(),
          byUserId: requestor.id,
        };

        const newRequest = manager.create(Request, {
          purpose: createRequestDto.purpose,
          items: requestItems,
          requestor,
          requestingOffice: office,
          createdBy: requestor,
          timeline: [initialEvent],
          displayId: 'PENDING', // replaced with a real ID once the row has one
        });

        // `items` cascades on save, inserting the RequestAsset rows too.
        const inserted = await manager.save(newRequest);
        inserted.displayId = `REQ-${inserted.createdAt.getFullYear()}-${inserted.id}`;

        // Still locked from the reads above. Recording the request on each
        // unit lets approve/reject move exactly these units later.
        await manager.update(InventoryItem, reservedUnitIds, {
          status: InventoryItemStatus.RESERVED,
          request: { id: inserted.id },
        });

        return manager.save(inserted);
      },
    );

    // Sent after the transaction commits — a delivery failure must not roll
    // back an already-valid submit (BEN-111).
    await this.sendNewRequestEmails(savedRequest, requestor);

    return savedRequest;
  }

  /**
   * On submit, notifies the requester ("Your request is in") and every admin
   * ("A new request needs your approval") — BEN-111.
   */
  private async sendNewRequestEmails(
    request: Request,
    requestor: User,
  ): Promise<void> {
    const context: RequestEmailContext = {
      requestId: request.id,
      displayId: request.displayId,
      submittedAt: request.createdAt,
      purpose: request.purpose,
      items: emailLines(request),
      requesterFirstName: requestor.firstName,
      requesterFullName: `${requestor.firstName} ${requestor.lastName}`.trim(),
      requesterOffice: request.requestingOffice,
      requesterEmail: requestor.email,
    };

    const admins = await this.requestsRepository.manager.find(User, {
      where: { role: UserRole.ADMIN },
      select: { email: true },
    });

    await Promise.all([
      this.mailerService.sendRequestSubmittedEmail(context),
      this.mailerService.sendRequestNeedsApprovalEmail(
        context,
        admins.map((admin) => admin.email),
      ),
    ]);
  }

  async update(
    id: number,
    updateRequestDto: UpdateRequestDto,
    actor: User,
  ): Promise<Request> {
    const request = await this.find(id);
    const { status, rejectionReason, pickupLocation, ...fields } =
      updateRequestDto;

    if (
      pickupLocation !== undefined &&
      status !== RequestStatus.READY_FOR_PICKUP
    ) {
      throw new BadRequestException(
        'pickupLocation can only be set when marking a request ready_for_pickup.',
      );
    }

    if (!status) {
      // No status change — a plain field edit (e.g. the purpose).
      await this.requestsRepository.save({ ...request, ...fields });
      return this.find(id);
    }

    const changedAt = new Date();
    let previousStatus = request.status;

    await this.requestsRepository.manager.transaction(async (manager) => {
      const currentStatus = await this.lockedStatus(manager, id);
      previousStatus = currentStatus;
      if (!LEGAL_TRANSITIONS[status].includes(currentStatus)) {
        throw new ConflictException(
          `A request with status '${currentStatus}' cannot be moved to '${status}'.`,
        );
      }

      // Stock reserved at submit stays reserved through approval and
      // handover (ADR-0006, FR-008/011), and leaves the store only when the
      // request is marked received (`receive()`, BEN-143); signing moves no
      // stock. A rejection returns the units to the shelf, dropping
      // their request link so a later request can claim them.
      if (status === RequestStatus.REJECTED) {
        await this.moveRequestUnits(
          manager,
          request,
          [InventoryItemStatus.RESERVED],
          {
            status: InventoryItemStatus.AVAILABLE,
            assignedTo: null,
            assignedAt: null,
            request: null,
          },
        );
      }

      const isDecision =
        status === RequestStatus.APPROVED || status === RequestStatus.REJECTED;

      await manager.save(Request, {
        ...request,
        ...fields,
        status,
        rejectionReason:
          status === RequestStatus.REJECTED
            ? (rejectionReason ?? null)
            : request.rejectionReason,
        // Recorded for pickup (FR-011a); cleared if the request moves to
        // delivery instead, so a stale location is never shown.
        pickupLocation:
          status === RequestStatus.READY_FOR_PICKUP
            ? (pickupLocation?.trim() ?? null)
            : status === RequestStatus.FOR_DELIVERY
              ? null
              : request.pickupLocation,
        reviewedBy: isDecision ? actor : request.reviewedBy,
        resolvedAt: (RESOLVED_STATUSES as readonly RequestStatus[]).includes(
          status,
        )
          ? changedAt
          : request.resolvedAt,
        updatedBy: actor,
        timeline: [
          ...request.timeline,
          {
            status,
            at: changedAt.toISOString(),
            byUserId: actor.id,
            ...(status === RequestStatus.REJECTED && rejectionReason
              ? { note: rejectionReason }
              : {}),
            ...(status === RequestStatus.READY_FOR_PICKUP && pickupLocation
              ? { note: `Pickup: ${pickupLocation.trim()}` }
              : {}),
          },
        ],
      });
    });

    const updated = await this.find(id);

    // Sent after the transaction commits — a delivery failure must not roll
    // back an already-valid status change.
    await this.sendStatusChangeEmail(
      updated,
      status,
      changedAt,
      rejectionReason,
      previousStatus,
    );

    return updated;
  }

  /**
   * Cancels a request with a reason (FR-010a/b/c): the requester may cancel
   * their own while it is pending approval; an admin may cancel one that has
   * been approved but not completed. The claimed stock returns to Available
   * in the same transaction as the status change.
   */
  async cancel(
    id: number,
    cancelRequestDto: CancelRequestDto,
    actor: User,
  ): Promise<Request> {
    // Scoped by `actor`, so an employee gets 404 for someone else's request.
    const request = await this.find(id, actor);
    const reason = cancelRequestDto.reason.trim();
    const isAdmin = actor.role === UserRole.ADMIN;
    const cancellable = isAdmin ? ADMIN_CANCELLABLE : EMPLOYEE_CANCELLABLE;
    const changedAt = new Date();
    let previousStatus = request.status;

    await this.requestsRepository.manager.transaction(async (manager) => {
      const currentStatus = await this.lockedStatus(manager, id);
      previousStatus = currentStatus;
      if (!cancellable.includes(currentStatus)) {
        throw new ConflictException(
          isAdmin
            ? `A request with status '${currentStatus}' cannot be cancelled by an admin; only approved requests not yet received can be (reject a pending request instead).`
            : `A request with status '${currentStatus}' cannot be cancelled; you can only cancel a request while it is pending approval.`,
        );
      }

      // The reserved units go back on the shelf, free for another request to
      // claim. Assigned is included for requests approved under BEN-110's
      // original rule, whose units were assigned on approval. (A received
      // request's units are assigned too, but it can't be cancelled.)
      await this.moveRequestUnits(
        manager,
        request,
        [InventoryItemStatus.RESERVED, InventoryItemStatus.ASSIGNED],
        {
          status: InventoryItemStatus.AVAILABLE,
          assignedTo: null,
          assignedAt: null,
          request: null,
        },
      );

      await manager.save(Request, {
        ...request,
        status: RequestStatus.CANCELLED,
        cancellationReason: reason,
        cancelledBy: actor,
        resolvedAt: changedAt,
        updatedBy: actor,
        timeline: [
          ...request.timeline,
          {
            status: RequestStatus.CANCELLED,
            at: changedAt.toISOString(),
            byUserId: actor.id,
            note: reason,
          },
        ],
      });
    });

    const cancelled = await this.find(id);

    // Sent after the transaction commits, like every status email.
    await this.sendStatusChangeEmail(
      cancelled,
      RequestStatus.CANCELLED,
      changedAt,
      reason,
      previousStatus,
    );

    return cancelled;
  }

  /**
   * Marks a handed-over request Received: the requester now has the items
   * (BEN-143). Either an admin or the requester may do it, from
   * for_delivery or ready_for_pickup. The reserved units are assigned to the
   * requester in the same transaction — this is when the items leave the
   * store. The requester is then emailed to sign the Accountability Form.
   */
  async receive(id: number, actor: User): Promise<Request> {
    // Scoped by `actor`: an employee gets 404 for someone else's request,
    // an admin can reach any.
    const request = await this.find(id, actor);
    const changedAt = new Date();
    let previousStatus = request.status;

    await this.requestsRepository.manager.transaction(async (manager) => {
      const currentStatus = await this.lockedStatus(manager, id);
      previousStatus = currentStatus;
      if (!RECEIVABLE.includes(currentStatus)) {
        throw new ConflictException(
          `A request with status '${currentStatus}' cannot be marked received; only a for_delivery or ready_for_pickup request can.`,
        );
      }

      // Assigned units keep their request link as a record of which request
      // issued them.
      await this.moveRequestUnits(
        manager,
        request,
        [InventoryItemStatus.RESERVED],
        {
          status: InventoryItemStatus.ASSIGNED,
          assignedTo: request.requestor,
          assignedAt: changedAt,
        },
      );

      await manager.save(Request, {
        ...request,
        status: RequestStatus.RECEIVED,
        receivedAt: changedAt,
        updatedBy: actor,
        timeline: [
          ...request.timeline,
          {
            status: RequestStatus.RECEIVED,
            at: changedAt.toISOString(),
            byUserId: actor.id,
          },
        ],
      });
    });

    const received = await this.find(id);

    // Sent after the transaction commits, like every status email.
    await this.sendStatusChangeEmail(
      received,
      RequestStatus.RECEIVED,
      changedAt,
      undefined,
      previousStatus,
    );

    return received;
  }

  /**
   * The requester signs the Accountability Form for a Received request,
   * which completes it (BEN-143). Only the requester can sign, and only
   * once: a completed request can't be signed again.
   */
  async sign(
    id: number,
    signRequestDto: SignRequestDto,
    actor: User,
  ): Promise<Request> {
    // Employee-only (controller), and scoped by `actor`, so someone else's
    // request is a 404.
    const request = await this.find(id, actor);
    const signature = signRequestDto.fullName.trim();
    const notes = signRequestDto.notes?.trim() || null;
    const changedAt = new Date();
    let previousStatus = request.status;

    await this.requestsRepository.manager.transaction(async (manager) => {
      const currentStatus = await this.lockedStatus(manager, id);
      previousStatus = currentStatus;
      if (currentStatus !== RequestStatus.RECEIVED) {
        throw new ConflictException(
          `A request with status '${currentStatus}' cannot be signed for; the accountability form is only accepted once a request is received.`,
        );
      }

      // The units were assigned when the request was marked received, so
      // signing moves no stock.
      await manager.save(Request, {
        ...request,
        status: RequestStatus.COMPLETED,
        receivedSignature: signature,
        receivedNotes: notes,
        resolvedAt: changedAt,
        updatedBy: actor,
        timeline: [
          ...request.timeline,
          {
            status: RequestStatus.COMPLETED,
            at: changedAt.toISOString(),
            byUserId: actor.id,
            note: `Signed by ${signature}`,
          },
        ],
      });
    });

    const completed = await this.find(id);

    // Sent after the transaction commits, like every status email.
    await this.sendStatusChangeEmail(
      completed,
      RequestStatus.COMPLETED,
      changedAt,
      undefined,
      previousStatus,
    );

    return completed;
  }

  /**
   * Moves the units this request claimed on submit (linked via
   * `InventoryItem.request`) that are currently in one of `from` into a new
   * state. Locked in a stable id order so two concurrent decisions can't
   * both move them.
   */
  private async moveRequestUnits(
    manager: EntityManager,
    request: Request,
    from: InventoryItemStatus[],
    changes: {
      status: InventoryItemStatus;
      assignedTo: User | null;
      assignedAt: Date | null;
      request?: null;
    },
  ): Promise<void> {
    const units = await manager
      .createQueryBuilder(InventoryItem, 'inventory')
      .setLock('pessimistic_write')
      .where('inventory.request_id = :requestId', { requestId: request.id })
      .andWhere('inventory.status IN (:...from)', { from })
      .orderBy('inventory.id', 'ASC')
      .getMany();

    if (!units.length) {
      return;
    }

    await manager.update(
      InventoryItem,
      units.map((unit) => unit.id),
      changes,
    );
  }

  /**
   * Re-reads the request's status under a row lock, inside the transaction
   * that will change it — so two concurrent status changes (an employee's
   * cancel and an admin's approve, say) can't both pass their checks.
   */
  private async lockedStatus(
    manager: EntityManager,
    id: number,
  ): Promise<RequestStatus> {
    const locked = await manager.findOne(Request, {
      where: { id },
      select: { id: true, status: true },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) {
      throw new NotFoundException(`Request with ID '${id}' could not be found.`);
    }
    return locked.status;
  }

  /** Dispatches the email for whichever transition just happened. */
  private async sendStatusChangeEmail(
    request: Request,
    status: RequestStatus,
    changedAt: Date,
    reason?: string,
    previousStatus?: RequestStatus,
  ): Promise<void> {
    const context: RequestEmailContext = {
      previousStatus,
      requestId: request.id,
      displayId: request.displayId,
      submittedAt: changedAt,
      purpose: request.purpose,
      items: emailLines(request),
      requesterFirstName: request.requestor.firstName,
      requesterFullName:
        `${request.requestor.firstName} ${request.requestor.lastName}`.trim(),
      requesterOffice: request.requestingOffice,
      pickupLocation: request.pickupLocation,
      requesterEmail: request.requestor.email,
    };

    switch (status) {
      case RequestStatus.APPROVED:
        return this.mailerService.sendRequestApprovedEmail(context);
      case RequestStatus.REJECTED:
        return this.mailerService.sendRequestRejectedEmail(
          context,
          reason ?? request.rejectionReason ?? '',
        );
      case RequestStatus.CANCELLED:
        return this.mailerService.sendRequestCancelledEmail(
          context,
          reason ?? request.cancellationReason ?? '',
          request.cancelledBy?.id === request.requestor.id,
        );
      case RequestStatus.READY_FOR_PICKUP:
        return this.mailerService.sendRequestReadyForPickupEmail(context);
      case RequestStatus.FOR_DELIVERY:
        return this.mailerService.sendRequestForDeliveryEmail(context);
      case RequestStatus.RECEIVED:
        return this.mailerService.sendRequestReceivedEmail(context);
      case RequestStatus.COMPLETED:
        return this.mailerService.sendRequestCompletedEmail(context);
      default:
        return;
    }
  }

  /**
   * Soft-deletes a request. Units it still holds as Reserved go back on the
   * shelf in the same transaction, or they would stay reserved for a request
   * nobody can see. Assigned units (a received or completed request) stay
   * with the employee who has them.
   */
  async delete(id: number, actor: User): Promise<Request> {
    const request = await this.find(id);

    await this.requestsRepository.manager.transaction(async (manager) => {
      await this.lockedStatus(manager, id);
      await this.moveRequestUnits(
        manager,
        request,
        [InventoryItemStatus.RESERVED],
        {
          status: InventoryItemStatus.AVAILABLE,
          assignedTo: null,
          assignedAt: null,
          request: null,
        },
      );
      await manager.update(Request, id, { deletedBy: actor });
      await manager.softDelete(Request, id);
    });

    return this.requestsRepository.findOneOrFail({
      where: { id },
      relations: RELATIONS,
      withDeleted: true,
    });
  }

  /**
   * Attaches each item's current available stock at the request's office
   * (same counting logic as `AssetsService.attachQuantities()`:
   * `InventoryItem` rows with status `AVAILABLE`) — per PR #79 review, so an
   * admin view can show live stock alongside a request's line items without
   * a second round-trip.
   */
  private async attachAvailableStock(requests: Request[]): Promise<Request[]> {
    const assetIds = [
      ...new Set(requests.flatMap((r) => r.items.map((item) => item.asset.id))),
    ];
    if (!assetIds.length) {
      return requests;
    }

    const counts = await this.requestsRepository.manager
      .createQueryBuilder(InventoryItem, 'inventory')
      .select('inventory.asset_id', 'assetId')
      .addSelect('inventory.location', 'office')
      .addSelect('COUNT(inventory.id)', 'count')
      .where('inventory.asset_id IN (:...assetIds)', { assetIds })
      .andWhere('inventory.status = :status', {
        status: InventoryItemStatus.AVAILABLE,
      })
      .groupBy('inventory.asset_id')
      .addGroupBy('inventory.location')
      .getRawMany<{ assetId: number; office: string; count: string }>();

    const stockKey = (assetId: number, office: string) => `${assetId}@${office}`;
    const stock = new Map(
      counts.map(({ assetId, office, count }) => [
        stockKey(assetId, office),
        Number(count),
      ]),
    );

    for (const request of requests) {
      for (const item of request.items) {
        Object.assign(item, {
          availableStock:
            stock.get(stockKey(item.asset.id, request.requestingOffice)) ?? 0,
        });
      }
    }

    return requests;
  }
}
