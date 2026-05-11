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
  supportEmail = "support@sitehaus.dev",
}: ReturnRefundedProps) => (
  <Html>
    <Head />
    <Header storeName={storeName} />
    <Tailwind>
      <Preview>Your return for order #{orderNumber} has been refunded.</Preview>
      <Body className="bg-white">
        <Container className="px-3 mx-auto">
          <Heading className="text-[#333] text-2xl font-bold mt-10 mb-2 p-0">
            Return Refunded
          </Heading>
          <Text className="text-[#333] text-sm m-0">
            Hi {name}, we've received your return and your refund has been processed. Thank you for
            giving us the chance to make it right.
          </Text>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Refund details
          </Text>
          <Row>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Order number</Text>
              <Text className="text-[#333] text-sm font-bold m-0">#{orderNumber}</Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Refund amount</Text>
              <Text className="text-[#333] text-sm font-bold m-0">
                {formatAmount(refundAmount, currency)}
              </Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Refund to</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{refundMethod}</Text>
            </Column>
          </Row>
          <Row className="mt-2">
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Refund date</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{refundDate}</Text>
            </Column>
          </Row>

          <Hr className="border-[#eee] my-4" />

          <OrderItemsTable items={items} />

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#333] text-sm my-1">
            Funds typically appear within <strong>{estimatedDays} business days</strong> depending
            on your bank or card issuer. Store credit is available immediately.
          </Text>

          <Text className="text-[#898989] text-xs leading-[22px] mt-6 mb-6">
            Questions about your refund?{" "}
            <Link href={`mailto:${supportEmail}`} className="text-[#898989] underline">
              {supportEmail}
            </Link>
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
  supportEmail: "support@sitehaus.dev",
} satisfies ReturnRefundedProps;

export default ReturnRefundedEmail;
