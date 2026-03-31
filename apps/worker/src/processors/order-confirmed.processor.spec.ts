import { Test, TestingModule } from "@nestjs/testing";
import { DB_TOKEN, EmailService } from "@sitehaus-ecom/shared";
import { OrderConfirmedProcessor } from "./order-confirmed.processor";

const ORDER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const STORE_ID = "aaaaaaaa-0000-4000-8000-000000000002";

const mockOrder = {
  id: ORDER_ID,
  storeId: STORE_ID,
  email: "customer@example.com",
  status: "confirmed",
  currency: "usd",
  subtotalCents: 2500,
  shippingCents: 0,
  taxCents: 0,
  totalCents: 2500,
  shippingName: "Jane Doe",
  shippingLine1: "123 Main St",
  shippingLine2: null,
  shippingCity: "Vancouver",
  shippingState: "BC",
  shippingZip: "V6B 1A1",
  shippingCountry: "CA",
};

const mockItems = [
  {
    productName: "Vitamin C",
    variantName: "90 Capsules",
    quantity: 1,
    unitPriceCents: 2500,
    totalCents: 2500,
  },
];

const mockStore = { name: "Health & Co." };

function selectChain(rows: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(rows),
    }),
  };
}

describe("OrderConfirmedProcessor", () => {
  let processor: OrderConfirmedProcessor;
  let db: any;
  let mockSend: jest.Mock;

  beforeEach(async () => {
    mockSend = jest.fn().mockResolvedValue(undefined);

    db = {
      query: {
        ordersTable: { findFirst: jest.fn() },
        storesTable: { findFirst: jest.fn() },
      },
      select: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderConfirmedProcessor,
        { provide: DB_TOKEN, useValue: db },
        { provide: EmailService, useValue: { send: mockSend } },
      ],
    }).compile();

    processor = module.get(OrderConfirmedProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  it("ignores jobs that are not order.confirmed", async () => {
    await processor.process({ name: "order.shipped", data: {} } as any);

    expect(db.query.ordersTable.findFirst).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends confirmation email with correct to and subject", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
    db.query.storesTable.findFirst.mockResolvedValue(mockStore);
    db.select.mockReturnValue(selectChain(mockItems));

    await processor.process({
      name: "order.confirmed",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        subject: `Order confirmed — #${ORDER_ID.slice(0, 8).toUpperCase()}`,
      }),
    );
  });

  it("email HTML contains item names and formatted total", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
    db.query.storesTable.findFirst.mockResolvedValue(mockStore);
    db.select.mockReturnValue(selectChain(mockItems));

    await processor.process({
      name: "order.confirmed",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain("Vitamin C");
    expect(html).toContain("90 Capsules");
    expect(html).toContain("$25.00");
  });

  it("email HTML contains store name", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
    db.query.storesTable.findFirst.mockResolvedValue(mockStore);
    db.select.mockReturnValue(selectChain(mockItems));

    await processor.process({
      name: "order.confirmed",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain("Health &amp; Co.");
  });

  it("does not send email when order not found", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(null);

    await processor.process({
      name: "order.confirmed",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("does not send email when storeId does not match", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue({ ...mockOrder, storeId: "other-store" });

    await processor.process({
      name: "order.confirmed",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("falls back to 'Your Store' when store record is missing", async () => {
    db.query.ordersTable.findFirst.mockResolvedValue(mockOrder);
    db.query.storesTable.findFirst.mockResolvedValue(null);
    db.select.mockReturnValue(selectChain(mockItems));

    await processor.process({
      name: "order.confirmed",
      data: { orderId: ORDER_ID, storeId: STORE_ID },
    } as any);

    const { html } = mockSend.mock.calls[0][0];
    expect(html).toContain("Your Store");
  });
});
