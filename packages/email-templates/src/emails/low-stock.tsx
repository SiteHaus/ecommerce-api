import { Body, Container, Head, Heading, Html, Preview, Row, Column, Text, Hr, Tailwind } from "react-email";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { tailwindConfig } from "../theme";

interface LowStockProps {
  storeName: string;
  productName: string;
  variantName: string;
  sku?: string | null;
  stock: number;
  available: number;
  lowStockThreshold: number;
}

export const LowStockEmail = ({
  storeName,
  productName,
  variantName,
  sku,
  stock,
  available,
  lowStockThreshold,
}: LowStockProps) => (
  <Html>
    <Head />
    <Header storeName={storeName} />
    <Tailwind config={tailwindConfig}>
      <Preview>{`${productName} — ${variantName} is running low (${available} available).`}</Preview>
      <Body className="bg-parchment">
        <Container className="px-3 mx-auto">
          <Heading className="text-ink text-2xl font-bold mt-10 mb-2 p-0">
            Running low on stock
          </Heading>
          <Text className="text-ink text-sm m-0">
            One of your products has dropped to or below your low-stock threshold of{" "}
            {lowStockThreshold} units. Might be time to reorder or update your listing.
          </Text>

          <Hr className="border-line my-4" />

          <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            Product
          </Text>
          <Row>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Product</Text>
              <Text className="text-ink text-sm font-bold m-0">{productName}</Text>
              <Text className="text-clay-700 text-[11px] m-0">{variantName}</Text>
            </Column>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">SKU</Text>
              <Text className="text-ink text-sm font-bold m-0">{sku ?? "—"}</Text>
            </Column>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Available</Text>
              <Text className="text-ink text-sm font-bold m-0">{available}</Text>
            </Column>
          </Row>

          <Hr className="border-line my-4" />

          <Text className="text-clay-700 text-xs leading-[22px] mt-6 mb-6">
            Raw stock on hand: {stock}. This only accounts for what's actually in inventory, not
            what's reserved in open carts.
          </Text>
        </Container>
      </Body>
      <Footer />
    </Tailwind>
  </Html>
);

LowStockEmail.PreviewProps = {
  storeName: "One Health",
  productName: "Essential Mag",
  variantName: "60 Capsules",
  sku: "ESS-MAG-60",
  stock: 4,
  available: 4,
  lowStockThreshold: 5,
} satisfies LowStockProps;

export default LowStockEmail;
