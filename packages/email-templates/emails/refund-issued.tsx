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

type RefundMethod = "Original payment method" | "Store credit" | "Gift card";

interface RefundIssuedProps {
  name: string;
  orderNumber: string;
  refundAmount: number;
  refundMethod: RefundMethod;
  refundedItems: string[];
  estimatedDays: number;
  supportEmail: string;
}

export const RefundIssuedEmail = ({
  name,
  orderNumber,
  refundAmount,
  refundMethod,
  refundedItems,
  estimatedDays,
  supportEmail,
}: RefundIssuedProps) => (
  <Html>
    <Head />
    <Header />
    <Tailwind>
      <Preview>Your refund of ${refundAmount.toFixed(2)} is on its way.</Preview>
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
              <Text className="text-[#333] text-sm font-bold m-0">${refundAmount.toFixed(2)}</Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Refund to</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{refundMethod}</Text>
            </Column>
          </Row>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Items refunded
          </Text>
          {refundedItems.map((item, i) => (
            <Text key={i} className="text-[#333] text-sm my-1">
              {item}
            </Text>
          ))}

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
  name: "Jane",
  orderNumber: "10492",
  refundAmount: 54.99,
  refundMethod: "Original payment method",
  refundedItems: ["Wireless Headphones × 1"],
  estimatedDays: 5,
  supportEmail: "support@sitehaus.dev",
} satisfies RefundIssuedProps;

export default RefundIssuedEmail;
