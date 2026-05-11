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

interface ReturnRefundedProps {
  name: string;
  orderNumber: string;
  refundAmount: number;
  refundMethod: RefundMethod;
  refundedItems: string[];
  refundDate: string;
  estimatedDays: number;
  supportEmail: string;
}

export const ReturnRefundedEmail = ({
  name,
  orderNumber,
  refundAmount,
  refundMethod,
  refundedItems,
  refundDate,
  estimatedDays,
  supportEmail,
}: ReturnRefundedProps) => (
  <Html>
    <Head />
    <Header />
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
              <Text className="text-[#333] text-sm font-bold m-0">${refundAmount.toFixed(2)}</Text>
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

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Items returned
          </Text>
          {refundedItems.map((item, i) => (
            <Text key={i} className="text-[#333] text-sm my-1">
              {item}
            </Text>
          ))}

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
  name: "Jane",
  orderNumber: "10492",
  refundAmount: 54.99,
  refundMethod: "Original payment method",
  refundedItems: ["Wireless Headphones × 1"],
  refundDate: "May 4, 2026",
  estimatedDays: 5,
  supportEmail: "support@sitehaus.dev",
} satisfies ReturnRefundedProps;

export default ReturnRefundedEmail;
