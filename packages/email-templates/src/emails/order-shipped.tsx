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
import { OrderItemsTable, OrderItem } from "../components/order-items";

interface OrderShippedProps {
  storeName: string;
  name: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  trackingNumber: string;
  trackingUrl?: string | null;
  carrier?: string | null;
  estimatedDelivery?: string | null;
  shippingName: string;
  shippingLine1: string;
  shippingLine2?: string | null;
  shippingCity: string;
  shippingState?: string | null;
  shippingZip: string;
  shippingCountry: string;
  supportEmail?: string;
}

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

export const OrderShippedEmail = ({
  storeName,
  name,
  orderNumber,
  items,
  subtotal,
  shipping,
  tax,
  total,
  currency,
  trackingNumber,
  trackingUrl,
  carrier,
  estimatedDelivery,
  shippingName,
  shippingLine1,
  shippingLine2,
  shippingCity,
  shippingState,
  shippingZip,
  shippingCountry,
  supportEmail = "support@sitehaus.dev",
}: OrderShippedProps) => (
  <Html>
    <Head />
    <Header storeName={storeName} />
    <Tailwind>
      <Preview>Your order #{orderNumber} is on its way!</Preview>
      <Body className="bg-white">
        <Container className="px-3 mx-auto">
          <Heading className="text-[#333] text-2xl font-bold mt-10 mb-2 p-0">Order Shipped</Heading>
          <Text className="text-[#333] text-sm m-0">
            Hi {name}, your order #{orderNumber} has been picked up{carrier ? ` by ${carrier}` : ""}{" "}
            and is on its way!
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
            {carrier && (
              <Column>
                <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Carrier</Text>
                <Text className="text-[#333] text-sm font-bold m-0">{carrier}</Text>
              </Column>
            )}
            {estimatedDelivery && (
              <Column>
                <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Est. delivery</Text>
                <Text className="text-[#333] text-sm font-bold m-0">{estimatedDelivery}</Text>
              </Column>
            )}
          </Row>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Tracking
          </Text>
          <Text className="text-[#333] text-sm font-bold my-1">{trackingNumber}</Text>
          {trackingUrl && (
            <Button
              href={trackingUrl}
              className="bg-[#333] text-white text-sm font-medium px-5 py-3 rounded mt-2"
            >
              Track Your Order
            </Button>
          )}

          <Hr className="border-[#eee] my-4" />

          <OrderItemsTable items={items} />

          <Hr className="border-[#eee] my-4" />

          <Row>
            <Column>
              <Text className="text-[#333] text-sm my-1">Subtotal</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm my-1">{formatAmount(subtotal, currency)}</Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text className="text-[#333] text-sm my-1">Shipping</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm my-1">
                {shipping === 0 ? "Free" : formatAmount(shipping, currency)}
              </Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text className="text-[#333] text-sm my-1">Tax</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm my-1">{formatAmount(tax, currency)}</Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text className="text-[#333] text-sm font-bold my-1">Total</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm font-bold my-1">
                {formatAmount(total, currency)}
              </Text>
            </Column>
          </Row>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Delivering to
          </Text>
          <Text className="text-[#333] text-sm my-0">{shippingName}</Text>
          <Text className="text-[#333] text-sm my-0">{shippingLine1}</Text>
          {shippingLine2 && <Text className="text-[#333] text-sm my-0">{shippingLine2}</Text>}
          <Text className="text-[#333] text-sm my-0">
            {shippingCity}
            {shippingState ? `, ${shippingState}` : ""} {shippingZip}
          </Text>
          <Text className="text-[#333] text-sm my-0">{shippingCountry}</Text>

          <Text className="text-[#898989] text-xs leading-[22px] mt-6 mb-6">
            Questions about your order?{" "}
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

OrderShippedEmail.PreviewProps = {
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
    {
      productName: "USB-C Cable",
      variantName: "6ft",
      quantity: 2,
      unitPriceCents: 799,
      totalCents: 1598,
    },
  ],
  subtotal: 105.97,
  shipping: 0,
  tax: 8.48,
  total: 114.45,
  currency: "USD",
  trackingNumber: "1Z999AA10123456784",
  trackingUrl: "https://sitehaus.dev/track/1Z999AA10123456784",
  carrier: "UPS",
  estimatedDelivery: "May 7–9, 2026",
  shippingName: "Jane Doe",
  shippingLine1: "123 Main St",
  shippingLine2: null,
  shippingCity: "Salt Lake City",
  shippingState: "UT",
  shippingZip: "84101",
  shippingCountry: "US",
  supportEmail: "support@sitehaus.dev",
} satisfies OrderShippedProps;

export default OrderShippedEmail;
