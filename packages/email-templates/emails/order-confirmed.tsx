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
import { Footer } from "../components/footer";
import { OrderItemsTable, OrderItem } from "../components/order-items";

enum ShippingType {
  Standard = "Standard",
  Express = "Express",
}

interface OrderConfirmedProps {
  name: string;
  orderNumber: string;
  orderDate: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  deliveryAddress: string;
  shippingMethod: ShippingType;
}

export const OrderConfirmedEmail = ({
  name,
  orderNumber,
  orderDate,
  items,
  subtotal,
  shipping,
  tax,
  total,
  deliveryAddress,
  shippingMethod,
}: OrderConfirmedProps) => (
  <Html>
    <Head />
    <Header />
    <Tailwind>
      <Preview>Your order #{orderNumber} is confirmed!</Preview>
      <Body className="bg-white">
        <Container className="px-3 mx-auto">
          <Heading className="text-[#333] text-2xl font-bold mt-10 mb-2 p-0">
            Order Confirmed
          </Heading>
          <Text className="text-[#333] text-sm m-0">
            Hi {name}, thanks for your order! We'll let you know when it's on its way.
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
              <Text className="text-[#898989] text-[11px] m-0 mb-0.5">Shipping</Text>
              <Text className="text-[#333] text-sm font-bold m-0">{shippingMethod}</Text>
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
            Delivering to
          </Text>
          <Text className="text-[#333] text-sm my-1">{deliveryAddress}</Text>

          <Text className="text-[#898989] text-xs leading-[22px] mt-3 mb-6">
            Questions?{" "}
            <Link href="mailto:support@sitehaus.dev" className="text-[#898989] underline">
              support@sitehaus.dev
            </Link>
          </Text>
        </Container>
      </Body>
      <Footer />
    </Tailwind>
  </Html>
);

OrderConfirmedEmail.PreviewProps = {
  name: "Jane",
  orderNumber: "10492",
  orderDate: "May 2, 2026",
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
  shippingMethod: ShippingType.Standard,
} satisfies OrderConfirmedProps;

export default OrderConfirmedEmail;
