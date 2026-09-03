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
  Text,
  Hr,
  Tailwind,
} from "react-email";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { OrderItemsTable, OrderItem } from "../components/order-items";
import { tailwindConfig } from "../theme";

type RefundMethod = "Original payment method" | "Store credit" | "Gift card";

interface ReturnRefundedProps {
  storeName: string;
  name: string;
  orderNumber: string;
  items: OrderItem[];
  refundAmount: number;
  currency: string;
  refundMethod: RefundMethod;
  refundDate: string;
  estimatedDays: number;
  supportEmail?: string;
}

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

// The prop values are title-cased for the details table; mid-sentence they need
// to be lowercased ("back to your original payment method").
const inProse = (method: RefundMethod) => method.toLowerCase();

export const ReturnRefundedEmail = ({
  storeName,
  name,
  orderNumber,
  items,
  refundAmount,
  currency,
  refundMethod,
  refundDate,
  estimatedDays,
  supportEmail = "hello@sitehaus.dev",
}: ReturnRefundedProps) => (
  <Html>
    <Head />
    <Header storeName={storeName} />
    <Tailwind config={tailwindConfig}>
      <Preview>
        Your return arrived — {formatAmount(refundAmount, currency)} is on its way back to you.
      </Preview>
      <Body className="bg-parchment">
        <Container className="px-3 mx-auto">
          <Heading className="text-ink text-2xl font-bold mt-10 mb-2 p-0">
            Your return is refunded
          </Heading>
          <Text className="text-ink text-sm m-0">
            Hi {name}, your return reached us safely and we've sent {formatAmount(refundAmount, currency)}{" "}
            back to your {inProse(refundMethod)}. Thanks for giving us the chance to make it right.
          </Text>

          <Hr className="border-line my-4" />

          <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Your refund
          </Text>
          <Row>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Order number</Text>
              <Text className="text-ink text-sm font-bold m-0">#{orderNumber}</Text>
            </Column>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Refund amount</Text>
              <Text className="text-ink text-sm font-bold m-0">
                {formatAmount(refundAmount, currency)}
              </Text>
            </Column>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Refunded to</Text>
              <Text className="text-ink text-sm font-bold m-0">{refundMethod}</Text>
            </Column>
          </Row>
          <Row className="mt-2">
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Refunded on</Text>
              <Text className="text-ink text-sm font-bold m-0">{refundDate}</Text>
            </Column>
          </Row>

          <Hr className="border-line my-4" />

          <OrderItemsTable items={items} />

          <Hr className="border-line my-4" />

          <Text className="text-ink text-sm my-1">
            The money usually lands within <strong>{estimatedDays} business days</strong>, depending
            on your bank or card issuer. Store credit is already back in your balance.
          </Text>

          <Text className="text-ink-500 text-xs leading-[22px] mt-6 mb-6">
            Questions about your refund? We're happy to help at{" "}
            <Link href={`mailto:${supportEmail}`} className="text-clay-700 underline">
              {supportEmail}
            </Link>
            .
          </Text>
        </Container>
      </Body>
      <Footer />
    </Tailwind>
  </Html>
);

ReturnRefundedEmail.PreviewProps = {
  storeName: "One Health",
  name: "Jane",
  orderNumber: "10492",
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
  currency: "USD",
  refundMethod: "Original payment method",
  refundDate: "May 4, 2026",
  estimatedDays: 5,
  supportEmail: "hello@sitehaus.dev",
} satisfies ReturnRefundedProps;

export default ReturnRefundedEmail;
