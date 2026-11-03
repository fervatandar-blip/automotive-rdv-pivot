import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dal", () => ({
  requireGarageMember: vi.fn().mockResolvedValue({
    garage: { id: "garage-1" },
    profile: { id: "staff-1" },
    isOwner: true,
  }),
}));

type Call = { table: string; method: string; args: unknown[] };
const calls: Call[] = [];
// Per "table.method" result for the awaited/terminal call.
let results: Record<string, { data: unknown; error: unknown }>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from(table: string) {
        let operation = "select";
        const builder: Record<string, unknown> = {};
        const record = (method: string) => (...args: unknown[]) => {
          calls.push({ table, method, args });
          if (["insert", "update", "upsert", "delete"].includes(method)) operation = method;
          return builder;
        };
        for (const method of ["select", "insert", "update", "upsert", "delete", "eq", "is", "limit"]) {
          builder[method] = record(method);
        }
        const result = () => Promise.resolve(results[`${table}.${operation}`] ?? { data: null, error: null });
        builder.maybeSingle = result;
        builder.then = (resolve: (value: unknown) => unknown) => result().then(resolve);
        return builder;
      },
    })
  ),
}));

const { saveClientDetails, addCustomerVehicle } = await import("./clients");

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";

function form(fields: Record<string, string>) {
  const data = new FormData();
  data.set("lang", "en");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const writes = (table: string) =>
  calls.filter((call) => call.table === table && ["insert", "update", "upsert"].includes(call.method));

beforeEach(() => {
  calls.length = 0;
  results = {
    "garage_customers.update": { data: { id: CUSTOMER }, error: null },
    "garage_customers.select": { data: { id: CUSTOMER }, error: null },
    "garage_client_notes.upsert": { data: null, error: null },
    "vehicles.select": { data: [], error: null },
    "vehicles.insert": { data: null, error: null },
  };
});

describe("saveClientDetails", () => {
  it("updates a walk-in's contact on garage_customers and their notes separately", async () => {
    const result = await saveClientDetails(
      undefined,
      form({
        kind: "walk_in",
        subjectId: CUSTOMER,
        name: "Ana Costa",
        phone: "+352 621 12 34 56",
        notes: "Prefers SMS",
        isVip: "on",
      })
    );
    expect(result).toEqual({ saved: true });
    expect(writes("garage_customers")[0].args[0]).toEqual({
      full_name: "Ana Costa",
      phone: "+352 621 12 34 56",
      email: null,
    });
    const [upsert] = writes("garage_client_notes");
    expect(upsert.args[0]).toMatchObject({
      garage_id: "garage-1",
      garage_customer_id: CUSTOMER,
      notes: "Prefers SMS",
      is_vip: true,
      // A walk-in's phone lives on garage_customers, never in the notes row.
      phone: null,
      updated_by: "staff-1",
    });
    expect(upsert.args[1]).toEqual({ onConflict: "garage_id,garage_customer_id" });
  });

  it("never touches garage_customers for a registered client, and keeps their phone in the notes row", async () => {
    const result = await saveClientDetails(
      undefined,
      form({ kind: "client", subjectId: CLIENT, phone: "621 000 111", preferredContactTime: "Mornings" })
    );
    expect(result).toEqual({ saved: true });
    expect(writes("garage_customers")).toHaveLength(0);
    const [upsert] = writes("garage_client_notes");
    expect(upsert.args[0]).toMatchObject({
      client_id: CLIENT,
      phone: "621 000 111",
      preferred_contact_time: "Mornings",
      is_vip: false,
    });
    expect(upsert.args[1]).toEqual({ onConflict: "garage_id,client_id" });
  });

  it("requires a name and a way to reach a walk-in customer", async () => {
    const result = await saveClientDetails(undefined, form({ kind: "walk_in", subjectId: CUSTOMER }));
    expect(result?.errors?.name).toEqual(["nameRequired"]);
    expect(result?.errors?.phone).toEqual(["contactRequired"]);
    expect(calls).toHaveLength(0);
  });

  it("fails without writing notes when the customer isn't editable (e.g. anonymized)", async () => {
    results["garage_customers.update"] = { data: null, error: null };
    const result = await saveClientDetails(
      undefined,
      form({ kind: "walk_in", subjectId: CUSTOMER, name: "Ana", phone: "1234" })
    );
    expect(result?.message).toBe("saveFailed");
    expect(writes("garage_client_notes")).toHaveLength(0);
  });
});

describe("addCustomerVehicle", () => {
  it("adds a vehicle with a normalized duplicate check", async () => {
    const result = await addCustomerVehicle(
      undefined,
      form({ customerId: CUSTOMER, plate: "lu-12 34", model: "Golf", year: "2019" })
    );
    expect(result).toEqual({ added: true });
    const plateCheck = calls.find((call) => call.table === "vehicles" && call.method === "eq");
    expect(plateCheck?.args).toEqual(["plate_search", "LU1234"]);
    expect(writes("vehicles")[0].args[0]).toMatchObject({
      garage_customer_id: CUSTOMER,
      license_plate: "lu-12 34",
      model: "Golf",
      year: 2019,
    });
  });

  it("refuses a plate already in the directory", async () => {
    results["vehicles.select"] = { data: [{ id: "existing" }], error: null };
    const result = await addCustomerVehicle(undefined, form({ customerId: CUSTOMER, plate: "LU1234" }));
    expect(result?.errors?.plate).toEqual(["plateExists"]);
    expect(writes("vehicles")).toHaveLength(0);
  });

  it("needs at least a plate or a model", async () => {
    const result = await addCustomerVehicle(undefined, form({ customerId: CUSTOMER, year: "2019" }));
    expect(result?.errors?.plate).toEqual(["vehicleIdentify"]);
  });
});
