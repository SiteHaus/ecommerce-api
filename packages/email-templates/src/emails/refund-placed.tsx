import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Column,
  Section,
  Text,
  Hr,
  Tailwind,
  Button,
} from "react-email";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { OrderItemsTable, OrderItem } from "../components/order-items";
import { tailwindConfig } from "../theme";

type RefundMethod = "Original payment method" | "Store credit" | "Gift card";

/**
 * Merchant-only. This is the store owner's copy of a refund — never send it to
 * a customer. The customer-facing versions are `refund-issued` (refund on an
 * order) and `return-refunded` (refund after a return came back).
 */
interface RefundPlacedProps {
  storeName: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  refundAmount: number;
  /** Order total, so the template can tell a full refund from a partial one. */
  orderTotal: number;
  currency: string;
  refundMethod: RefundMethod;
  refundDate: string;
  /** Free-text reason captured when the refund was created, if any. */
  reason?: string | null;
  /** Who triggered it — a dashboard user, or Stripe for a dispute/chargeback. */
  initiatedBy?: string | null;
  // Same rule as the customer return email: only render the button when the
  // caller actually has a dashboard URL to point at.
  dashboardUrl?: string | null;
}

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

export const RefundPlacedEmail = ({
  storeName,
  orderNumber,
  customerName,
  customerEmail,
  items,
  refundAmount,
  orderTotal,
  currency,
  refundMethod,
  refundDate,
  reason,
  initiatedBy,
  dashboardUrl,
}: RefundPlacedProps) => {
  const isPartial = refundAmount < orderTotal;

  return (
    <Html>
      <Head />
      <Header storeName={storeName} />
      <Tailwind config={tailwindConfig}>
        <Preview>
          {`${isPartial ? "Partial refund" : "Refund"} of ${formatAmount(refundAmount, currency)} placed on order #${orderNumber}.`}
        </Preview>
        <Body className="bg-parchment">
          <Container className="px-3 mx-auto">
            <Heading className="text-ink text-2xl font-bold mt-10 mb-2 p-0">
              Refund placed on order #{orderNumber}
            </Heading>
            <Text className="text-ink text-sm m-0">
              A {isPartial ? "partial refund" : "full refund"} of{" "}
              {formatAmount(refundAmount, currency)} was placed on this order and{" "}
              {customerName} has been notified. The funds come out of your Stripe balance.
            </Text>

            <Hr className="border-line my-4" />

            <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
              Refund
            </Text>
            <Row>
              <Column>
                <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Order number</Text>
                <Text className="text-ink text-sm font-bold m-0">#{orderNumber}</Text>
              </Column>
              <Column>
                <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Refunded</Text>
                <Text className="text-ink text-sm font-bold m-0">
                  {formatAmount(refundAmount, currency)}
                </Text>
                <Text className="text-clay-700 text-[11px] m-0">
                  of {formatAmount(orderTotal, currency)}
                </Text>
              </Column>
              <Column>
                <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Type</Text>
                <Text className="text-ink text-sm font-bold m-0">
                  {isPartial ? "Partial" : "Full"}
                </Text>
              </Column>
            </Row>
            <Row className="mt-3">
              <Column>
                <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Refunded to</Text>
                <Text className="text-ink text-sm font-bold m-0">{refundMethod}</Text>
              </Column>
              <Column>
                <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Date</Text>
                <Text className="text-ink text-sm font-bold m-0">{refundDate}</Text>
              </Column>
              <Column>
                <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Placed by</Text>
                <Text className="text-ink text-sm font-bold m-0">{initiatedBy ?? "—"}</Text>
              </Column>
            </Row>

            <Hr className="border-line my-4" />

            <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
              Customer
            </Text>
            <Text className="text-ink text-sm font-bold m-0">{customerName}</Text>
            <Link href={`mailto:${customerEmail}`} className="text-clay-700 text-xs underline">
              {customerEmail}
            </Link>

            {reason && (
              <Section className="bg-parchment-100 border border-solid border-line-soft rounded px-4 py-1 mt-4">
                <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-2 mb-1">
                  Reason given
                </Text>
                <Text className="text-ink text-sm mt-0 mb-2">{reason}</Text>
              </Section>
            )}

            <Hr className="border-line my-4" />

            <OrderItemsTable items={items} />

            <Hr className="border-line my-4" />

            {dashboardUrl && (
              <Button
                href={dashboardUrl}
                className="bg-terracotta text-terracotta-foreground text-sm font-medium px-5 py-3 rounded"
              >
                Open Order in Dashboard
              </Button>
            )}

            <Text className="text-ink-500 text-xs leading-[22px] mt-6 mb-6">
              Refunding an order doesn't return anything to inventory — if these items came back to
              you, adjust the variants yourself. Stripe's own timing rules decide when the money
              actually leaves your balance and reaches the customer.
            </Text>
          </Container>
        </Body>
        <Footer />
      </Tailwind>
    </Html>
  );
};

RefundPlacedEmail.PreviewProps = {
  storeName: "One Health",
  orderNumber: "10492",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  items: [
    {
      productName: "Wireless Headphones",
      variantName: "Midnight Black",
      quantity: 1,
      unitPriceCents: 8999,
      totalCents: 8999,
    },
  ],
  refundAmount: 89.99,
  orderTotal: 129.99,
  currency: "USD",
  refundMethod: "Original payment method",
  refundDate: "May 4, 2026",
  reason: "Customer reported the left earcup rattling.",
  initiatedBy: "ethan@onehealth.com",
  dashboardUrl: "https://commerce.sitehaus.dev/onehealth/orders/10492",
} satisfies RefundPlacedProps;

export default RefundPlacedEmail;
