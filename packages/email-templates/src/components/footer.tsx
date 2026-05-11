import { Hr, Link, Section, Text, Img } from "react-email";

export const Footer = () => {
  return (
    <Section style={section}>
      <Hr style={hr} />
      <Text style={text}>
        Powered by{" "}
        <Link href="https://sitehaus.dev" style={link}>
          sitehaus.dev
        </Link>
      </Text>
      <Text style={copyright}>© {new Date().getFullYear()} Sitehaus. All rights reserved.</Text>
    </Section>
  );
};

const section = { textAlign: "center" as const };
const hr = { borderColor: "#eee", margin: "20px 40px 16px" };
const text = {
  color: "#444",
  fontSize: "12px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  lineHeight: "20px",
  margin: "0",
};
const link = { color: "#0a85ea", textDecoration: "none" };
const copyright = {
  color: "#aaa",
  fontSize: "11px",
  fontFamily: "HelveticaNeue,Helvetica,Arial,sans-serif",
  lineHeight: "18px",
  margin: "4px 0 0",
};
