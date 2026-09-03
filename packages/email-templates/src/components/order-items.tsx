import { Row, Column, Text, Hr } from "react-email";
import { sitehausColors } from "../theme";

export interface OrderItem {
  productName: string;
  variantName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

interface OrderItemsTableProps {
  items: OrderItem[];
}

export const OrderItemsTable = ({ items }: OrderItemsTableProps) => (
  <>
    <Text
      style={{
        color: sitehausColors.clay700,
        fontSize: "11px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginTop: "16px",
        marginBottom: "8px",
      }}
    >
      Items
    </Text>

    {/* Table header */}
    <Row>
      <Column style={{ width: "50%" }}>
        <Text
          style={{
            color: sitehausColors.clay700,
            fontSize: "11px",
            margin: "0 0 6px 0",
            borderBottom: `1px solid ${sitehausColors.line}`,
            paddingBottom: "6px",
          }}
        >
          Item
        </Text>
      </Column>
      <Column style={{ width: "15%", textAlign: "center" }}>
        <Text
          style={{
            color: sitehausColors.clay700,
            fontSize: "11px",
            margin: "0 0 6px 0",
            borderBottom: `1px solid ${sitehausColors.line}`,
            paddingBottom: "6px",
          }}
        >
          Qty
        </Text>
      </Column>
      <Column style={{ width: "17%", textAlign: "right" }}>
        <Text
          style={{
            color: sitehausColors.clay700,
            fontSize: "11px",
            margin: "0 0 6px 0",
            borderBottom: `1px solid ${sitehausColors.line}`,
            paddingBottom: "6px",
          }}
        >
          Price
        </Text>
      </Column>
      <Column style={{ width: "18%", textAlign: "right" }}>
        <Text
          style={{
            color: sitehausColors.clay700,
            fontSize: "11px",
            margin: "0 0 6px 0",
            borderBottom: `1px solid ${sitehausColors.line}`,
            paddingBottom: "6px",
          }}
        >
          Total
        </Text>
      </Column>
    </Row>

    {/* Table rows */}
    {items.map((item, i) => (
      <Row key={i}>
        <Column style={{ width: "50%", paddingTop: "8px", paddingBottom: "8px" }}>
          <Text style={{ color: sitehausColors.ink, fontSize: "14px", margin: "0 0 2px 0", fontWeight: "500" }}>
            {item.productName}
          </Text>
          <Text style={{ color: sitehausColors.clay700, fontSize: "11px", margin: "0" }}>
            {item.variantName}
          </Text>
        </Column>
        <Column style={{ width: "15%", textAlign: "center", paddingTop: "8px" }}>
          <Text style={{ color: sitehausColors.ink, fontSize: "14px", margin: "0" }}>{item.quantity}</Text>
        </Column>
        <Column style={{ width: "17%", textAlign: "right", paddingTop: "8px" }}>
          <Text style={{ color: sitehausColors.ink, fontSize: "14px", margin: "0" }}>
            {formatCents(item.unitPriceCents)}
          </Text>
        </Column>
        <Column style={{ width: "18%", textAlign: "right", paddingTop: "8px" }}>
          <Text style={{ color: sitehausColors.ink, fontSize: "14px", margin: "0" }}>
            {formatCents(item.totalCents)}
          </Text>
        </Column>
      </Row>
    ))}

    <Hr style={{ borderColor: sitehausColors.line, marginTop: "4px", marginBottom: "0" }} />
  </>
);
