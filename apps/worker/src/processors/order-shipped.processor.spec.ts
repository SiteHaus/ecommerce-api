import { Test, TestingModule } from "@nestjs/testing";
import { DB_TOKEN, EmailService } from "@sitehaus-ecom/shared";
import { NotificationsProcessor as OrderShippedProcessor } from "./order-confirmed.processor";

const ORDER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const STORE_ID = "aaaaaaaa-0000-4000-8000-000000000002";

const mockOrder = {
  id: ORDER_ID,
  storeId: STORE_ID,
  email: "customer@example.com",
  status: "shipped",
  trackingNumber: "1Z999AA1012345678",
  shippingName: "Jane Doe",
  shippingLine1: "123 Main St",
  shippingLine2: null,
  shippingCity: "Vancouver",
  shippingState: "BC",
  shippingZip: "V6B 1A1",
  shippingCountry: "CA",
};

const mockStore = { name: "Health & Co." };

describe("OrderShippedProcessor", () => {
  let processor: OrderShippedProcessor;
  let db: any;
  let mockSend: jest.Mock;

  beforeEach(async () => {
    mockSend = jest.fn().mockResolvedValue(undefined);

    db = {
      query: {
        ordersTable: { findFirst: jest.fn() },
        storesTable: { findFirst: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderShippedProcessor,
        { provide: DB_TOKEN, useValue: db },
        { provide: EmailService, useValue: { send: mockSend } },
      ],
    }).compile();

    processor = module.get(OrderShippedProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  it("ignores unknown job names", async () => {
    await processor.process({ name: "order.unknown", data: {} } as any);

    expect(db.query.ordersTable.findFirst).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends shipped email with correct to and subject", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
    db.query.storesTable.findFirst.mockResolvedValue(mockStore);

    await processor.process({
      name: "order.shipped",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: "Your order has shipped!",
      }),
    );
  });

  it("email HTML contains tracking number when present", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
    db.query.storesTable.findFirst.mockResolvedValue(mockStore);

    await processor.process({
      name: "order.shipped",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain("1Z999AA1012345678");
  });

  it("still sends email when trackingNumber is null", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, trackingNumber: null });
    db.query.storesTable.findFirst.mockResolvedValue(mockStore);

    await processor.process({
      name: "order.shipped",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const { html } = mockSend.mock.calls[0][0];
    expect(html).not.toContain("Tracking number");
  });

  it("email HTML contains store name", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
    db.query.storesTable.findFirst.mockResolvedValue(mockStore);

    await processor.process({
      name: "order.shipped",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain("Health &amp; Co.");
  });

  it("does not send email when order not found", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(null);

    await processor.process({
      name: "order.shipped",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not send email when storeId does not match", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, storeId: "other-store" });

    await processor.process({
      name: "order.shipped",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("falls back to 'Your Store' when store record is missing", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
    db.query.storesTable.findFirst.mockResolvedValue(null);

    await processor.process({
      name: "order.shipped",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain("Your Store");
  });
});
