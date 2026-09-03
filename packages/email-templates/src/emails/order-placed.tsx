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
import { Header } from "../components/header";
import { tailwindConfig } from "../theme";
import { Footer } from "../components/footer";
import { OrderItemsTable, OrderItem } from "../components/order-items";

interface OrderPlacedProps {
  storeName: string;
  name: string;
  orderId: string;
  orderNumber: string;
  orderDate: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  shippingName: string;
  shippingLine1: string;
  shippingLine2?: string | null;
  shippingCity: string;
  shippingState?: string | null;
  shippingZip: string;
  shippingCountry: string;
  trackingNumber?: string | null;
  supportEmail?: string;
  storeUrl?: string;
}

const formatAmount = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

export const OrderPlacedEmail = ({
  storeName,
  name,
  orderNumber,
  orderDate,
  orderId,
  items,
  subtotal,
  shipping,
  tax,
  total,
  currency,
  shippingName,
  shippingLine1,
  shippingLine2,
  shippingCity,
  shippingState,
  shippingZip,
  shippingCountry,
  trackingNumber,
  supportEmail = "hello@sitehaus.dev",
  storeUrl = "https://sitehaus.dev",
}: OrderPlacedProps) => {
  const orderUrl = `${storeUrl}/orders/${orderId}`;

  return (
    <Html>
      <Head />
      <Header storeName={storeName} />
      <Tailwind config={tailwindConfig}>
        <Preview>Order #{orderNumber} has been placed!</Preview>
        <Body className="bg-parchment">
          <Container className="px-3 mx-auto">
            <Heading className="text-ink text-2xl font-bold mt-10 mb-2 p-0">
              Order Placed
            </Heading>
            <Text className="text-ink text-sm m-0">{name}, just placed an order!</Text>

            <Link
              href={orderUrl}
              className="inline-block bg-terracotta text-terracotta-foreground text-sm font-bold px-4 py-2 rounded mt-4 no-underline"
            >
              View Order
            </Link>

            <Hr className="border-line my-4" />

            <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
              Order details
            </Text>
            <Row>
              <Column>
                <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Order number</Text>
                <Text className="text-ink text-sm font-bold m-0">#{orderNumber}</Text>
              </Column>
              <Column>
                <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Order date</Text>
                <Text className="text-ink text-sm font-bold m-0">{orderDate}</Text>
              </Column>
            </Row>

            <Hr className="border-line my-4" />

            <OrderItemsTable items={items} />

            <Hr className="border-line my-4" />

            <Row>
              <Column>
                <Text className="text-ink text-sm my-1">Subtotal</Text>
              </Column>
              <Column className="text-right">
                <Text className="text-ink text-sm my-1">{formatAmount(subtotal, currency)}</Text>
              </Column>
            </Row>
            <Row>
              <Column>
                <Text className="text-ink text-sm my-1">Shipping</Text>
              </Column>
              <Column className="text-right">
                <Text className="text-ink text-sm my-1">
                  {shipping === 0 ? "Free" : formatAmount(shipping, currency)}
                </Text>
              </Column>
            </Row>
            <Row>
              <Column>
                <Text className="text-ink text-sm my-1">Tax</Text>
              </Column>
              <Column className="text-right">
                <Text className="text-ink text-sm my-1">{formatAmount(tax, currency)}</Text>
              </Column>
            </Row>
            <Row>
              <Column>
                <Text className="text-ink text-sm font-bold my-1">Total</Text>
              </Column>
              <Column className="text-right">
                <Text className="text-ink text-sm font-bold my-1">
                  {formatAmount(total, currency)}
                </Text>
              </Column>
            </Row>

            <Hr className="border-line my-4" />

            <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
              Delivering to
            </Text>
            <Text className="text-ink text-sm my-0">{shippingName}</Text>
            <Text className="text-ink text-sm my-0">{shippingLine1}</Text>
            {shippingLine2 && <Text className="text-ink text-sm my-0">{shippingLine2}</Text>}
            <Text className="text-ink text-sm my-0">
              {shippingCity}
              {shippingState ? `, ${shippingState}` : ""} {shippingZip}
            </Text>
            <Text className="text-ink text-sm my-0">{shippingCountry}</Text>

            {trackingNumber && (
              <>
                <Hr className="border-line my-4" />
                <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
                  Tracking
                </Text>
                <Text className="text-ink text-sm my-1">
                  Tracking number: <span style={{ fontWeight: "bold" }}>{trackingNumber}</span>
                </Text>
              </>
            )}

            <Text className="text-clay-700 text-xs leading-[22px] mt-6 mb-6">
              Questions?{" "}
              <Link href={`mailto:${supportEmail}`} className="text-clay-700 underline">
                {supportEmail}
              </Link>
            </Text>
          </Container>
        </Body>
        <Footer />
      </Tailwind>
    </Html>
  );
};

OrderPlacedEmail.PreviewProps = {
  storeName: "One Health",
  name: "Jane",
  orderNumber: "10492",
  orderDate: "May 2, 2026",
  orderId: "12341234",
  storeUrl: "https://commerce.sitehaus.dev/onehealth",
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
  shippingName: "Jane Doe",
  shippingLine1: "123 Main St",
  shippingLine2: null,
  shippingCity: "Salt Lake City",
  shippingState: "UT",
  shippingZip: "84101",
  shippingCountry: "US",
  trackingNumber: null,
  supportEmail: "support@sitehaus.dev",
} satisfies OrderPlacedProps;

export default OrderPlacedEmail;
