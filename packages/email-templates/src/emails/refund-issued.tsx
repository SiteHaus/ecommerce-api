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

interface RefundIssuedProps {
  storeName: string;
  name: string;
  orderNumber: string;
  items: OrderItem[];
  refundAmount: number;
  currency: string;
  refundMethod: RefundMethod;
  estimatedDays: number;
  supportEmail?: string;
}

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

export const RefundIssuedEmail = ({
  storeName,
  name,
  orderNumber,
  items,
  refundAmount,
  currency,
  refundMethod,
  estimatedDays,
  supportEmail = "support@sitehaus.dev",
}: RefundIssuedProps) => (
  <Html>
    <Head />
    <Header storeName={storeName} />
    <Tailwind>
      <Preview>Your refund of {formatAmount(refundAmount, currency)} is on its way.</Preview>
      <Body className="bg-white">
        <Container className="px-3 mx-auto">
          <Heading className="text-[#333] text-2xl font-bold mt-10 mb-2 p-0">Refund Issued</Heading>
          <Text className="text-[#333] text-sm m-0">
            Hi {name}, your refund has been issued. Please allow a few business days for it to
            appear depending on your bank or card issuer.
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

          <Hr className="border-[#eee] my-4" />

          <OrderItemsTable items={items} />

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#333] text-sm my-1">
            Refunds typically appear within <strong>{estimatedDays} business days</strong>. If you
            paid with store credit, the balance will be available immediately.
          </Text>

          <Text className="text-[#898989] text-xs leading-[22px] mt-6 mb-6">
            Didn't request this refund or have questions?{" "}
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

RefundIssuedEmail.PreviewProps = {
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
  estimatedDays: 5,
  supportEmail: "support@sitehaus.dev",
} satisfies RefundIssuedProps;

export default RefundIssuedEmail;
