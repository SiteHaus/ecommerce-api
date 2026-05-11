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
  Button,
} from "react-email";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
interface ReturnRequestedProps {
  name: string;
  orderNumber: string;
  returnRequestDate: string;
  returnItems: string[];
  returnReason: string;
  returnPortalUrl: string;
  supportEmail: string;
}

export const ReturnRequestedEmail = ({
  name,
  orderNumber,
  returnRequestDate,
  returnItems,
  returnReason,
  returnPortalUrl,
  supportEmail,
}: ReturnRequestedProps) => (
  <Html>
    <Head />
    <Header />
    <Tailwind>
      <Preview>We've received your return request for order #{orderNumber}.</Preview>
      <Body className="bg-white">
        <Container className="px-3 mx-auto">
          <Heading className="text-[#333] text-2xl font-bold mt-10 mb-2 p-0">
            Return Requested
          </Heading>
          <Text className="text-[#333] text-sm m-0">
            Hi {name}, we've received your return request and our team is reviewing it. You'll hear
            back from us within 1–2 business days.
          </Text>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Request details
          </Text>
          <Row>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Order number</Text>
              <Text className="text-[#333] text-sm font-bold m-0">#{orderNumber}</Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Request date</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{returnRequestDate}</Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Reason</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{returnReason}</Text>
            </Column>
          </Row>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Items to return
          </Text>
          {returnItems.map((item, i) => (
            <Text key={i} className="text-[#333] text-sm my-1">
              {item}
            </Text>
          ))}

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            What's next?
          </Text>
          <Text className="text-[#333] text-sm mt-1 mb-3">
            Once your return is approved, you'll receive a prepaid shipping label by email. You can
            also track the status of your return at any time in your account.
          </Text>
          <Button
            href={returnPortalUrl}
            className="bg-[#333] text-white text-sm font-medium px-5 py-3 rounded"
          >
            View Return Status
          </Button>

          <Text className="text-[#898989] text-xs leading-[22px] mt-6 mb-6">
            Questions about your return?{" "}
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

ReturnRequestedEmail.PreviewProps = {
  name: "Jane",
  orderNumber: "10492",
  returnRequestDate: "May 4, 2026",
  returnItems: ["Wireless Headphones × 1"],
  returnReason: "Item not as described",
  returnPortalUrl: "https://sitehaus.dev/returns/10492",
  supportEmail: "support@sitehaus.dev",
} satisfies ReturnRequestedProps;

export default ReturnRequestedEmail;
