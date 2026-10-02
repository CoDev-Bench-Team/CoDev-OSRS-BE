import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  InventoryItem,
  InventoryItemStatus,
} from '../inventory-items/entities/inventory-item.entity.js';
import { MailerService } from '../mailer/mailer.service.js';
import { User, UserRole } from '../users/entities/user.entity.js';
import { Request, RequestStatus } from './entities/request.entity.js';
import { RequestsService } from './requests.service.js';

describe('RequestsService', () => {
  let service: RequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: getRepositoryToken(Request), useValue: {} },
        { provide: MailerService, useValue: {} },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('RequestsService handover, receipt and signing (BEN-143)', () => {
  const admin = { id: 1, role: UserRole.ADMIN } as User;
  const maya = { id: 2, role: UserRole.EMPLOYEE } as User;
  const mailer = {
    sendRequestApprovedEmail: vi.fn(),
    sendRequestReadyForPickupEmail: vi.fn(),
    sendRequestForDeliveryEmail: vi.fn(),
    sendRequestReceivedEmail: vi.fn(),
    sendRequestCompletedEmail: vi.fn(),
  };
  let service: RequestsService;
  let manager: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  /** The units the request holds, as the stubbed stock query returns them. */
  let units: { id: number }[];

  /** Stubs the database with a request currently in `status`. */
  const given = (status: RequestStatus) => {
    const request = {
      id: 7,
      displayId: 'REQ-7',
      status,
      purpose: null,
      pickupLocation: null,
      rejectionReason: null,
      resolvedAt: null,
      reviewedBy: null,
      timeline: [],
      items: [
        {
          quantity: 1,
          asset: { name: 'Business Laptop', model: 'Dell Latitude' },
        },
      ],
      requestor: {
        id: 2,
        firstName: 'Maya',
        lastName: 'Santos',
        email: 'maya@codev.com',
      },
      requestingOffice: 'Cebu',
    } as unknown as Request;
    const query = {
      setLock: () => query,
      where: () => query,
      andWhere: () => query,
      orderBy: () => query,
      getMany: async () => units,
    };
    manager = {
      findOne: vi.fn().mockResolvedValue({ id: 7, status }),
      save: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn(() => query),
    };
    service = new RequestsService(
      {
        manager: {
          transaction: (work: (m: typeof manager) => Promise<void>) =>
            work(manager),
        },
      } as never,
      mailer as unknown as MailerService,
    );
    vi.spyOn(service, 'find').mockResolvedValue(request);
  };

  const emailsSent = () =>
    Object.entries(mailer)
      .filter(([, send]) => send.mock.calls.length)
      .map(([name]) => name);

  const saved = () => manager.save.mock.calls[0][1];

  beforeEach(() => {
    Object.values(mailer).forEach((send) => send.mockReset());
    units = [{ id: 101 }, { id: 102 }];
  });

  describe('update() (admin status changes)', () => {
    it('lists each item as "Name - Model" in the email, as the design does', async () => {
      given(RequestStatus.PENDING_APPROVAL);
      await service.update(7, { status: RequestStatus.APPROVED }, admin);

      expect(emailsSent()).toEqual(['sendRequestApprovedEmail']);
      expect(mailer.sendRequestApprovedEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [{ itemName: 'Business Laptop - Dell Latitude', quantity: 1 }],
        }),
      );
    });

    it.each([
      [
        RequestStatus.APPROVED,
        RequestStatus.READY_FOR_PICKUP,
        'sendRequestReadyForPickupEmail',
      ],
      [
        RequestStatus.APPROVED,
        RequestStatus.FOR_DELIVERY,
        'sendRequestForDeliveryEmail',
      ],
      [
        RequestStatus.READY_FOR_PICKUP,
        RequestStatus.FOR_DELIVERY,
        'sendRequestForDeliveryEmail',
      ],
    ])(
      'sends only the status email on %s → %s; signing comes later',
      async (from, to, email) => {
        given(from);
        await service.update(
          7,
          {
            status: to,
            ...(to === RequestStatus.READY_FOR_PICKUP
              ? { pickupLocation: 'Front desk' }
              : {}),
          },
          admin,
        );

        expect(emailsSent()).toEqual([email]);
      },
    );

    it.each([
      [RequestStatus.FOR_DELIVERY, RequestStatus.RECEIVED],
      [RequestStatus.RECEIVED, RequestStatus.COMPLETED],
    ])(
      'refuses %s → %s; that status has its own endpoint',
      async (from, to) => {
        given(from);

        await expect(service.update(7, { status: to }, admin)).rejects.toThrow(
          ConflictException,
        );
        expect(manager.save).not.toHaveBeenCalled();
        expect(emailsSent()).toEqual([]);
      },
    );
  });

  describe('receive() (mark received)', () => {
    it.each([
      ['an admin', admin],
      ['the requester', maya],
    ])(
      'lets %s mark a handed-over request received, assigning its units',
      async (_, actor) => {
        given(RequestStatus.FOR_DELIVERY);
        await service.receive(7, actor);

        expect(saved()).toMatchObject({
          status: RequestStatus.RECEIVED,
          receivedAt: expect.any(Date),
        });
        expect(saved().receivedSignature).toBeUndefined();
        expect(manager.update).toHaveBeenCalledWith(
          InventoryItem,
          [101, 102],
          expect.objectContaining({ status: InventoryItemStatus.ASSIGNED }),
        );
        expect(emailsSent()).toEqual(['sendRequestReceivedEmail']);
      },
    );

    it('works from ready for pickup too', async () => {
      given(RequestStatus.READY_FOR_PICKUP);
      await service.receive(7, maya);

      expect(saved().status).toBe(RequestStatus.RECEIVED);
    });

    it.each([
      RequestStatus.APPROVED,
      RequestStatus.RECEIVED,
      RequestStatus.COMPLETED,
      RequestStatus.CANCELLED,
    ])('refuses a %s request', async (status) => {
      given(status);

      await expect(service.receive(7, admin)).rejects.toThrow(
        ConflictException,
      );
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(emailsSent()).toEqual([]);
    });
  });

  describe('sign() (the Accountability Form)', () => {
    const form = {
      agreed: true,
      fullName: '  Maya Santos ',
      notes: ' With laptop bag ',
    };

    it('completes a received request and stores the signature, moving no stock', async () => {
      given(RequestStatus.RECEIVED);
      await service.sign(7, form, maya);

      expect(saved()).toMatchObject({
        status: RequestStatus.COMPLETED,
        receivedSignature: 'Maya Santos',
        receivedNotes: 'With laptop bag',
        resolvedAt: expect.any(Date),
        timeline: [
          expect.objectContaining({
            status: RequestStatus.COMPLETED,
            note: 'Signed by Maya Santos',
          }),
        ],
      });
      expect(manager.update).not.toHaveBeenCalled();
      expect(emailsSent()).toEqual(['sendRequestCompletedEmail']);
    });

    it.each([
      RequestStatus.READY_FOR_PICKUP,
      RequestStatus.FOR_DELIVERY,
      RequestStatus.COMPLETED,
    ])('refuses a %s request; it must be received first', async (status) => {
      given(status);

      await expect(service.sign(7, form, maya)).rejects.toThrow(
        ConflictException,
      );
      expect(manager.save).not.toHaveBeenCalled();
      expect(emailsSent()).toEqual([]);
    });
  });
});
