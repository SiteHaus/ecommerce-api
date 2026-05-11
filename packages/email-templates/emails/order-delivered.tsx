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

interface OrderDeliveredProps {
  name: string;
  orderNumber: string;
  orderDate: string;
  deliveredDate: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  deliveryAddress: string;
  reviewUrl: string;
  supportEmail: string;
}

export const OrderDeliveredEmail = ({
  name,
  orderNumber,
  orderDate,
  deliveredDate,
  items,
  subtotal,
  shipping,
  tax,
  total,
  deliveryAddress,
  reviewUrl,
  supportEmail,
}: OrderDeliveredProps) => (
  <Html>
    <Head />
    <Header />
    <Tailwind>
      <Preview>Your order #{orderNumber} has been delivered!</Preview>
      <Body className="bg-white">
        <Container className="px-3 mx-auto">
          <Heading className="text-[#333] text-2xl font-bold mt-10 mb-2 p-0">
            Order Delivered
          </Heading>
          <Text className="text-[#333] text-sm m-0">
            Hi {name}, great news — your order has been delivered! We hope you love what you
            ordered.
          </Text>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Order details
          </Text>
          <Row>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Order number</Text>
              <Text className="text-[#333] text-sm font-bold m-0">#{orderNumber}</Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Order date</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{orderDate}</Text>
            </Column>
            <Column>
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Delivered</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{deliveredDate}</Text>
            </Column>
          </Row>

          <Hr className="border-[#eee] my-4" />

          <OrderItemsTable items={items} />

          <Hr className="border-[#eee] my-4" />

          <Row>
            <Column>
              <Text className="text-[#333] text-sm my-1">Subtotal</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm my-1">${subtotal.toFixed(2)}</Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text className="text-[#333] text-sm my-1">Shipping</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm my-1">
                {shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}
              </Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text className="text-[#333] text-sm my-1">Tax</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm my-1">${tax.toFixed(2)}</Text>
            </Column>
          </Row>
          <Row>
            <Column>
              <Text className="text-[#333] text-sm font-bold my-1">Total</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm font-bold my-1">${total.toFixed(2)}</Text>
            </Column>
          </Row>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Delivered to
          </Text>
          <Text className="text-[#333] text-sm my-1">{deliveryAddress}</Text>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            How did we do?
          </Text>
          <Text className="text-[#333] text-sm mt-1 mb-3">
            We'd love to hear what you think. Leave a review and help others find what they love.
          </Text>
          <Button
            href={reviewUrl}
            className="bg-[#333] text-white text-sm font-medium px-5 py-3 rounded"
          >
            Leave a Review
          </Button>

          <Text className="text-[#898989] text-xs leading-[22px] mt-6 mb-6">
            Something wrong with your order?{" "}
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

OrderDeliveredEmail.PreviewProps = {
  name: "Jane",
  orderNumber: "10492",
  orderDate: "May 2, 2026",
  deliveredDate: "May 4, 2026",
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
  deliveryAddress: "123 Main St, Salt Lake City, UT 84101",
  reviewUrl: "https://sitehaus.dev/review/10492",
  supportEmail: "support@sitehaus.dev",
} satisfies OrderDeliveredProps;

export default OrderDeliveredEmail;
