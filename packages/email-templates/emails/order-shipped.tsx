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

interface OrderShippedProps {
  name: string;
  orderNumber: string;
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  estimatedDelivery: string;
  deliveryAddress: string;
}

export const OrderShippedEmail = ({
  name,
  orderNumber,
  trackingNumber,
  trackingUrl,
  carrier,
  estimatedDelivery,
  deliveryAddress,
}: OrderShippedProps) => (
  <Html>
    <Head />
    <Header />
    <Tailwind>
      <Preview>Your order #{orderNumber} is on its way!</Preview>
      <Body className="bg-white">
        <Container className="px-3 mx-auto">
          <Heading className="text-[#333] text-2xl font-bold mt-10 mb-2 p-0">Order Shipped</Heading>
          <Text className="text-[#333] text-sm m-0">
            Hi {name}, your order #{orderNumber} has been picked up by {carrier} and is on its way!
          </Text>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Shipment details
          </Text>
          <Row>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Order number</Text>
              <Text className="text-[#333] text-sm font-bold m-0">#{orderNumber}</Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Carrier</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{carrier}</Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Est. delivery</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{estimatedDelivery}</Text>
            </Column>
          </Row>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Tracking
          </Text>
          <Text className="text-[#333] text-sm font-bold my-1">{trackingNumber}</Text>
          <Button
            href={trackingUrl}
            className="bg-[#333] text-white text-sm font-medium px-5 py-3 rounded mt-2"
          >
            Track Your Order
          </Button>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Delivering to
          </Text>
          <Text className="text-[#333] text-sm my-1">{deliveryAddress}</Text>

          <Text className="text-[#898989] text-xs leading-[22px] mt-6 mb-6">
            Questions about your order?{" "}
            <Link href="mailto:support@sitehaus.dev" className="text-[#898989] underline">
              support@sitehaus.dev
            </Link>
          </Text>

          <Footer />
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

OrderShippedEmail.PreviewProps = {
  name: "Jane",
  orderNumber: "10492",
  trackingNumber: "1Z999AA10123456784",
  trackingUrl: "https://sitehaus.dev/track/1Z999AA10123456784",
  carrier: "UPS",
  estimatedDelivery: "May 7–9, 2026",
  deliveryAddress: "123 Main St, Salt Lake City, UT 84101",
} satisfies OrderShippedProps;

export default OrderShippedEmail;
