import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  Req,
  HttpCode,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { RequestsService } from './requests.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateRequestDto } from './dto/update-request.dto.js';
import { CancelRequestDto } from './dto/cancel-request.dto.js';
import { SignRequestDto } from './dto/sign-request.dto.js';
import { PaginatedRequestsQueryDto } from './dto/paginated-requests-query.dto.js';
import { PaginatedRequestHistoryQueryDto } from './dto/paginated-request-history-query.dto.js';
import {
  RequestCounts,
  RequestCountsQueryDto,
} from './dto/request-counts.dto.js';
import {
  PaginatedRequestsResponseDto,
  RequestResponseDto,
} from './dto/request-response.dto.js';
import { ApiValidationProblemResponse } from '../common/api-validation-problem-response.decorator.js';
import { ApiProblemResponse } from '../common/api-problem-response.decorator.js';
import { Roles } from '../auth/roles.decorator.js';

const ApiRequestIdParam = () =>
  ApiParam({
    name: 'id',
    description: 'The numeric request identifier (not the REQ-… display ID).',
    type: Number,
  });

const ApiUnauthorizedProblem = () =>
  ApiProblemResponse(401, 'No valid session cookie.', 'Unauthorized');

const ApiForbiddenProblem = (who: string) =>
  ApiProblemResponse(403, `The signed-in user is not ${who}.`, 'Insufficient permissions.');

const ApiRequestNotFoundProblem = (description = 'No request has this ID.') =>
  ApiProblemResponse(404, description, "Request with ID '42' could not be found.");

@ApiTags('Requests')
@ApiCookieAuth('session')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @ApiOperation({
    summary:
      'List equipment requests with requester, item, and workflow details.',
    description:
      "Admins get every request (the Requests Queue); employees get only their own (My Requests). Supports filtering by status, display ID, requester name/email or user ID (requesterId), and requested item name, plus sorting by submission date (newest/oldest) or employee name (A-Z). Each line item carries the asset's live `availableStock` at the request's office.",
  })
  @ApiOkResponse({
    description: 'One page of requests, plus paging totals.',
    type: PaginatedRequestsResponseDto,
  })
  @ApiValidationProblemResponse(PaginatedRequestsQueryDto)
  @ApiUnauthorizedProblem()
  @Get()
  paginate(
    @Query() paginatedRequestsQueryDto: PaginatedRequestsQueryDto,
    @Req() request: ExpressRequest,
  ) {
    // The global AuthGuard rejects unauthenticated requests before this
    // handler runs, so `request.user` is always populated here.
    return this.requestsService.paginate(
      paginatedRequestsQueryDto,
      request.user!,
    );
  }

  // `counts` and `history` are declared before `:id` so they aren't parsed
  // as request IDs.
  @ApiOperation({
    summary: 'Counts requests per status, for filter chips and summary cards.',
    description:
      'Takes the same search filters as the list (not status) and the same scoping: admins count every request, employees their own. inProcessing = approved + ready_for_pickup + for_delivery + received. For the low-stock card, use GET /assets?stockLevel=low_stock.',
  })
  @ApiOkResponse({ type: RequestCounts })
  @ApiValidationProblemResponse(RequestCountsQueryDto)
  @ApiUnauthorizedProblem()
  @Get('counts')
  counts(
    @Query() countsQueryDto: RequestCountsQueryDto,
    @Req() request: ExpressRequest,
  ) {
    return this.requestsService.counts(countsQueryDto, request.user!);
  }

  @ApiOperation({
    summary: 'Retrieves the History: resolved requests, admin only.',
    description:
      'Completed, rejected and cancelled requests across all requesters (FR-016a), with resolvedAt and the stored rejectionReason / cancellationReason. Same search, filters and paging as the list; newest / oldest sort by resolution date.',
  })
  @ApiOkResponse({
    description: 'One page of resolved requests, plus paging totals.',
    type: PaginatedRequestsResponseDto,
  })
  @ApiValidationProblemResponse(PaginatedRequestHistoryQueryDto)
  @ApiUnauthorizedProblem()
  @ApiForbiddenProblem('an admin')
  @Roles('admin')
  @Get('history')
  history(
    @Query() historyQueryDto: PaginatedRequestHistoryQueryDto,
    @Req() request: ExpressRequest,
  ) {
    return this.requestsService.history(historyQueryDto, request.user!);
  }

  @ApiOperation({
    summary: 'Fetches a single request by its numeric identifier.',
    description:
      "Employees can only fetch their own requests; anyone else's returns 404.",
  })
  @ApiRequestIdParam()
  @ApiOkResponse({
    description:
      'The request, with its requester, reviewer, line items (with live `availableStock`) and timeline.',
    type: RequestResponseDto,
  })
  @ApiUnauthorizedProblem()
  @ApiRequestNotFoundProblem(
    "No request has this ID, or (for an employee) it is someone else's.",
  )
  @Get(':id')
  find(@Param('id', ParseIntPipe) id: number, @Req() request: ExpressRequest) {
    return this.requestsService.find(id, request.user!);
  }

  @ApiOperation({
    summary: 'Creates a new request using the supplied item details.',
    description:
      "Submitted as the signed-in user. Stock is reserved at the requester's own office; another office's stock can't be requested. All or nothing: every line is checked and reserved in one transaction, and if any line fails (unknown asset, not enough stock) nothing is created or reserved. Emails the requester and all admins. Business-rule refusals are a 400 whose `title` is a readable message (see the examples); field errors are a 400 with an `errors` array.",
  })
  @ApiCreatedResponse({
    description:
      'The new request, in `pending_approval`, with its display ID (`REQ-<year>-<id>`), `createdAt` and lines.',
    type: RequestResponseDto,
  })
  @ApiValidationProblemResponse(CreateRequestDto, {
    insufficientStock: {
      summary: 'Not enough Available units at the requester’s office',
      detail: "Insufficient stock for 'Dell 24 Monitor' at Cebu: requested 3, 1 available.",
    },
    unknownAsset: {
      summary: 'A line names an asset that does not exist',
      detail: "Asset with ID '99' could not be found.",
    },
    duplicateAsset: {
      summary: 'The same asset appears on two lines',
      detail: 'Each asset may only appear once per request.',
    },
    unknownOffice: {
      summary: "The requester's office isn't one stock is held at",
      detail:
        "Your account's office ('Manila') isn't one we hold stock at; ask an admin to update it.",
    },
  })
  @ApiUnauthorizedProblem()
  @ApiForbiddenProblem('an admin or employee')
  @Roles('admin', 'employee')
  @Post()
  create(
    @Body() createRequestDto: CreateRequestDto,
    @Req() request: ExpressRequest,
  ) {
    // The global AuthGuard rejects unauthenticated requests before this
    // handler runs, so `request.user` is always populated here.
    return this.requestsService.create(createRequestDto, request.user!);
  }

  @ApiOperation({
    summary: 'Edit a request or advance its fulfillment workflow.',
    description:
      'Admin only. Drives approve, reject (with a reason) and release: `pending_approval` → `approved` | `rejected`; `approved` → `ready_for_pickup` (with a pickupLocation) | `for_delivery`; the two release states are peers and can switch between each other, and `ready_for_pickup` can be set again to change the location. `received` and `completed` are not set here: see POST /requests/:id/receive and /sign. A rejection returns the reserved units to Available. Any other transition is refused with a 409. Each status change emails the requester.',
  })
  @ApiRequestIdParam()
  @ApiOkResponse({
    description: 'The updated request.',
    type: RequestResponseDto,
  })
  @ApiValidationProblemResponse(UpdateRequestDto)
  @ApiUnauthorizedProblem()
  @ApiForbiddenProblem('an admin')
  @ApiRequestNotFoundProblem()
  @ApiProblemResponse(
    409,
    'The requested status change is not allowed from the current status.',
    "A request with status 'pending_approval' cannot be moved to 'for_delivery'.",
  )
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRequestDto: UpdateRequestDto,
    @Req() request: ExpressRequest,
  ) {
    // The global AuthGuard rejects unauthenticated requests before this
    // handler runs, so `request.user` is always populated here.
    return this.requestsService.update(id, updateRequestDto, request.user!);
  }

  @ApiOperation({
    summary: 'Cancels a request, with a reason.',
    description:
      "An employee may cancel their own request while it is pending approval; an admin may cancel an approved, ready-for-pickup or for-delivery request that can't be fulfilled. The request's stock returns to Available and the requester is emailed. Any other status (including received) returns 409.",
  })
  @ApiRequestIdParam()
  @ApiOkResponse({
    description: 'The cancelled request, with cancellationReason and cancelledBy.',
    type: RequestResponseDto,
  })
  @ApiValidationProblemResponse(CancelRequestDto)
  @ApiUnauthorizedProblem()
  @ApiRequestNotFoundProblem(
    "No request has this ID, or (for an employee) it is someone else's.",
  )
  @ApiProblemResponse(
    409,
    'The request cannot be cancelled from its current status by this user.',
    "A request with status 'approved' cannot be cancelled; you can only cancel a request while it is pending approval.",
  )
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelRequestDto: CancelRequestDto,
    @Req() request: ExpressRequest,
  ) {
    // The global AuthGuard rejects unauthenticated requests before this
    // handler runs, so `request.user` is always populated here.
    return this.requestsService.cancel(id, cancelRequestDto, request.user!);
  }

  @ApiOperation({
    summary: 'Marks a handed-over request received.',
    description:
      "An admin (any request) or the requester (their own) confirms the items were delivered or claimed, while the request is for_delivery or ready_for_pickup. No body. Moves the request to received, assigns the reserved units to the requester (the items leave the store), and emails them to sign the Accountability Form. Someone else's request returns 404 for an employee; any other status, including an already-received one, returns 409.",
  })
  @ApiRequestIdParam()
  @ApiOkResponse({
    description: 'The request, now `received`, with receivedAt.',
    type: RequestResponseDto,
  })
  @ApiUnauthorizedProblem()
  @ApiRequestNotFoundProblem(
    "No request has this ID, or (for an employee) it is someone else's.",
  )
  @ApiProblemResponse(
    409,
    'The request is not waiting to be received.',
    "A request with status 'approved' cannot be marked received; only a for_delivery or ready_for_pickup request can.",
  )
  @Roles('admin', 'employee')
  @HttpCode(200)
  @Post(':id/receive')
  receive(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: ExpressRequest,
  ) {
    // The global AuthGuard rejects unauthenticated requests before this
    // handler runs, so `request.user` is always populated here.
    return this.requestsService.receive(id, request.user!);
  }

  @ApiOperation({
    summary: 'Signs the Accountability Form, completing a received request.',
    description:
      "Employee only, on their own request while it is received. Stores the typed name and notes, moves the request to completed and emails the requester. Moves no stock: the units were assigned when the request was marked received. Someone else's request returns 404; any other status, including an already-completed one, returns 409.",
  })
  @ApiRequestIdParam()
  @ApiOkResponse({
    description:
      'The request, now `completed`, with receivedSignature, receivedNotes and resolvedAt.',
    type: RequestResponseDto,
  })
  @ApiValidationProblemResponse(SignRequestDto)
  @ApiUnauthorizedProblem()
  @ApiForbiddenProblem('an employee')
  @ApiRequestNotFoundProblem("No request has this ID, or it is someone else's.")
  @ApiProblemResponse(
    409,
    'The request is not waiting to be signed for.',
    "A request with status 'for_delivery' cannot be signed for; the accountability form is only accepted once a request is received.",
  )
  @Roles('employee')
  @HttpCode(200)
  @Post(':id/sign')
  sign(
    @Param('id', ParseIntPipe) id: number,
    @Body() signRequestDto: SignRequestDto,
    @Req() request: ExpressRequest,
  ) {
    // The global AuthGuard rejects unauthenticated requests before this
    // handler runs, so `request.user` is always populated here.
    return this.requestsService.sign(id, signRequestDto, request.user!);
  }

  @ApiOperation({
    summary: 'Removes a request from the system by ID.',
    description:
      'Admin only. A soft delete: the request disappears from every list but stays in the database with deletedAt and deletedBy. Units it still holds as Reserved return to Available; units already Assigned to the employee (a received or completed request) stay assigned. No email is sent.',
  })
  @ApiRequestIdParam()
  @ApiOkResponse({ description: 'The removed request.', type: RequestResponseDto })
  @ApiUnauthorizedProblem()
  @ApiForbiddenProblem('an admin')
  @ApiRequestNotFoundProblem()
  @Roles('admin')
  @Delete(':id')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: ExpressRequest,
  ) {
    return this.requestsService.delete(id, request.user!);
  }
}
