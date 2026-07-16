import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#18181b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  brand: { fontSize: 18, fontWeight: 700 },
  muted: { color: "#71717a" },
  section: { marginBottom: 24 },
  label: { fontSize: 9, color: "#71717a", marginBottom: 2 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  table: {
    marginTop: 8,
    borderTop: "1px solid #e4e4e7",
    borderBottom: "1px solid #e4e4e7",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    color: "#71717a",
    fontSize: 9,
  },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 8,
    borderTop: "1px solid #18181b",
    fontSize: 12,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#a1a1aa",
    textAlign: "center",
  },
});

export type InvoiceData = {
  invoiceNumber: string;
  issuedAt: string;
  garage: {
    name: string;
    address: string | null;
    city: string | null;
    email: string | null;
    vatNumber: string | null;
  };
  client: {
    name: string;
    email: string;
  };
  service: {
    name: string;
    durationMinutes: number;
    price: number;
  };
  appointmentDate: string;
  currency: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-LU", {
    style: "currency",
    currency,
  }).format(amount);
}

function InvoiceDocument({ invoice }: { invoice: InvoiceData }) {
  const issued = new Date(invoice.issuedAt).toLocaleDateString("fr-LU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const serviceDate = new Date(invoice.appointmentDate).toLocaleDateString(
    "fr-LU",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>RDV</Text>
            <Text style={styles.muted}>rendez-vous automobile</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>
              Invoice {invoice.invoiceNumber}
            </Text>
            <Text style={styles.muted}>Issued {issued}</Text>
          </View>
        </View>

        <View style={[styles.row, styles.section]}>
          <View>
            <Text style={styles.label}>FROM</Text>
            <Text>{invoice.garage.name}</Text>
            {invoice.garage.address && <Text>{invoice.garage.address}</Text>}
            {invoice.garage.city && <Text>{invoice.garage.city}</Text>}
            {invoice.garage.email && <Text>{invoice.garage.email}</Text>}
            {invoice.garage.vatNumber && (
              <Text>VAT {invoice.garage.vatNumber}</Text>
            )}
          </View>
          <View>
            <Text style={styles.label}>BILL TO</Text>
            <Text>{invoice.client.name}</Text>
            <Text>{invoice.client.email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>SERVICE DATE</Text>
          <Text>{serviceDate}</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text>Description</Text>
              <Text>Amount</Text>
            </View>
            <View style={styles.tableRow}>
              <Text>
                {invoice.service.name} ({invoice.service.durationMinutes} min)
              </Text>
              <Text>
                {formatMoney(invoice.service.price, invoice.currency)}
              </Text>
            </View>
          </View>

          <View style={styles.total}>
            <Text>Total</Text>
            <Text>
              {formatMoney(invoice.service.price, invoice.currency)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Generated automatically by RDV on behalf of {invoice.garage.name}.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}
