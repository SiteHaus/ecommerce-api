import { Section, Text, Img, Row, Column } from "react-email";

export const Header = ({
  storeName = "OneHealth Store",
  email = "orders@notify.sitehaus.dev",
  logoUrl,
}: {
  storeName?: string;
  email?: string;
  logoUrl?: string;
}) => {
  return (
    <Section style={section}>
      <Row>
        <Column style={logoCol}>
          {logoUrl ? (
            <Img src={logoUrl} alt={storeName} height="32" style={logo} />
          ) : (
            <Text style={wordmark}>{storeName}</Text>
          )}
        </Column>
        <Column style={fromCol}>
          <Text style={fromLabel}>From</Text>
          <Text style={fromValue}>
            {storeName} <span style={fromEmail}>&lt;{email}&gt;</span>
          </Text>
        </Column>
      </Row>
    </Section>
  );
};

const section = {
  padding: "24px 40px 20px",
  borderBottom: "1px solid #eee",
};

const logoCol = { verticalAlign: "middle" as const };

const fromCol = {
  verticalAlign: "middle" as const,
  textAlign: "right" as const,
};

const logo = { display: "block" };

const wordmark = {
  color: "#111",
  fontSize: "18px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  fontWeight: "700",
  margin: "0",
  lineHeight: "1",
};

const fromLabel = {
  color: "#aaa",
  fontSize: "10px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  margin: "0",
  lineHeight: "16px",
};

const fromValue = {
  color: "#444",
  fontSize: "12px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  lineHeight: "18px",
  margin: "2px 0 0",
};

const fromEmail = {
  color: "#aaa",
  fontSize: "11px",
};
