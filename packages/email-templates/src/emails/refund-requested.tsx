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
import { tailwindConfig } from "../theme";

interface ReturnRequestedProps {
  storeName: string;
  name: string;
  orderNumber: string;
  returnRequestDate: string;
  items: OrderItem[];
  returnReason: string;
  // No client site currently has a /returns tracking page to send this to —
  // omit until one exists rather than link to a page nobody built.
  returnPortalUrl?: string | null;
  supportEmail?: string;
}

export const ReturnRequestedEmail = ({
  storeName,
  name,
  orderNumber,
  returnRequestDate,
  items,
  returnReason,
  returnPortalUrl,
  supportEmail = "support@sitehaus.dev",
}: ReturnRequestedProps) => (
  <Html>
    <Head />
    <Header storeName={storeName} />
    <Tailwind config={tailwindConfig}>
      <Preview>We've got your return request for order #{orderNumber}.</Preview>
      <Body className="bg-parchment">
        <Container className="px-3 mx-auto">
          <Heading className="text-ink text-2xl font-bold mt-10 mb-2 p-0">
            We've got your return request
          </Heading>
          <Text className="text-ink text-sm m-0">
            Hi {name}, thanks for letting us know. We're reviewing your request now and you'll hear
            back from us within 1–2 business days — no need to follow up in the meantime.
          </Text>

          <Hr className="border-line my-4" />

          <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            What you asked for
          </Text>
          <Row>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Order number</Text>
              <Text className="text-ink text-sm font-bold m-0">#{orderNumber}</Text>
            </Column>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">You asked on</Text>
              <Text className="text-ink text-sm font-bold m-0">{returnRequestDate}</Text>
            </Column>
            <Column>
              <Text className="text-clay-700 text-[11px] m-0 mb-0.5">Your reason</Text>
              <Text className="text-ink text-sm font-bold m-0">{returnReason}</Text>
            </Column>
          </Row>

          <Hr className="border-line my-4" />

          <OrderItemsTable items={items} />

          <Hr className="border-line my-4" />

          <Text className="text-clay-700 text-[11px] font-bold uppercase tracking-wide mt-4 mb-2">
            What happens next
          </Text>
          <Text className="text-ink text-sm mt-1 mb-3">
            As soon as we approve your return, we'll email you a prepaid shipping label. Pack the
            items back up, drop the parcel off, and we'll take it from there — your refund follows
            once it reaches us.
          </Text>
          {returnPortalUrl && (
            <Button
              href={returnPortalUrl}
              className="bg-terracotta text-terracotta-foreground text-sm font-medium px-5 py-3 rounded"
            >
              Check Your Return Status
            </Button>
          )}

          <Text className="text-ink-500 text-xs leading-[22px] mt-6 mb-6">
            Need to change or cancel this request? Just reach out at{" "}
            <Link href={`mailto:${supportEmail}`} className="text-clay-700 underline">
              {supportEmail}
            </Link>
            .
          </Text>
        </Container>
      </Body>
      <Footer />
    </Tailwind>
  </Html>
);

ReturnRequestedEmail.PreviewProps = {
  storeName: "One Health",
  name: "Jane",
  orderNumber: "10492",
  returnRequestDate: "May 4, 2026",
  items: [
    {
      productName: "Wireless Headphones",
      variantName: "Midnight Black",
      quantity: 1,
      unitPriceCents: 8999,
      totalCents: 8999,
    },
  ],
  returnReason: "Item not as described",
  returnPortalUrl: "https://sitehaus.dev/returns/10492",
  supportEmail: "support@sitehaus.dev",
} satisfies ReturnRequestedProps;

export default ReturnRequestedEmail;
