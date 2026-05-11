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
  Img,
} from "react-email";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
interface CartItem {
  name: string;
  variant?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface AbandonedCartProps {
  name: string;
  cartItems: CartItem[];
  cartTotal: number;
  cartUrl: string;
  storeName: string;
  supportEmail: string;
}

export const AbandonedCartEmail = ({
  name,
  cartItems,
  cartTotal,
  cartUrl,
  storeName,
  supportEmail,
}: AbandonedCartProps) => (
  <Html>
    <Head />
    <Header />
    <Tailwind>
      <Preview>You left something behind — your cart is waiting.</Preview>
      <Body className="bg-white">
        <Container className="px-3 mx-auto">
          <Heading className="text-[#333] text-2xl font-bold mt-10 mb-2 p-0">
            You left something behind
          </Heading>
          <Text className="text-[#333] text-sm m-0">
            Hi {name}, you left some items in your cart at {storeName}. Come back and complete your
            purchase before they sell out.
          </Text>

          <Hr className="border-[#eee] my-4" />

          <Text className="text-[#898989] text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Your cart
          </Text>

          {cartItems.map((item, i) => (
            <Row key={i} className="mb-3">
              {item.imageUrl && (
                <Column className="w-[64px]">
                  <Img
                    src={item.imageUrl}
                    alt={item.name}
                    width={56}
                    height={56}
                    className="rounded object-cover"
                  />
                </Column>
              )}
              <Column>
                <Text className="text-[#333] text-sm font-bold m-0">{item.name}</Text>
                {item.variant && (
                  <Text className="text-[#898989] text-[11px] m-0">{item.variant}</Text>
                )}
                <Text className="text-[#898989] text-[11px] m-0">Qty: {item.quantity}</Text>
              </Column>
              <Column className="text-right">
                <Text className="text-[#333] text-sm font-bold m-0">
                  ${(item.price * item.quantity).toFixed(2)}
                </Text>
              </Column>
            </Row>
          ))}

          <Hr className="border-[#eee] my-4" />

          <Row>
            <Column>
              <Text className="text-[#333] text-sm font-bold my-1">Cart total</Text>
            </Column>
            <Column className="text-right">
              <Text className="text-[#333] text-sm font-bold my-1">${cartTotal.toFixed(2)}</Text>
            </Column>
          </Row>

          <Text className="text-[#898989] text-[11px] m-0 mt-1 mb-4">
            Shipping and taxes calculated at checkout.
          </Text>

          <Button
            href={cartUrl}
            className="bg-[#333] text-white text-sm font-medium px-5 py-3 rounded"
          >
            Return to Cart
          </Button>

          <Text className="text-[#898989] text-xs leading-[22px] mt-6 mb-6">
            Need help?{" "}
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

AbandonedCartEmail.PreviewProps = {
  name: "Jane",
  storeName: "Sitehaus",
  cartItems: [
    {
      name: "Wireless Headphones",
      variant: "Color: Midnight Black",
      price: 89.99,
      quantity: 1,
      imageUrl: "https://placehold.co/56x56",
    },
    {
      name: "USB-C Cable",
      variant: "Length: 6ft",
      price: 12.99,
      quantity: 2,
      imageUrl: "https://placehold.co/56x56",
    },
  ],
  cartTotal: 115.97,
  cartUrl: "https://sitehaus.dev/cart/recover/abc123",
  supportEmail: "support@sitehaus.dev",
} satisfies AbandonedCartProps;

export default AbandonedCartEmail;
