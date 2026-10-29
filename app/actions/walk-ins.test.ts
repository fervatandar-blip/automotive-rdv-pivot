import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/dal", () => ({
  requireGarageMember: vi.fn(() =>
    Promise.resolve({
      garage: { id: "garage-1", owner_id: "owner-1", owner_takes_bookings: true },
      profile: { id: "owner-1" },
      isOwner: true,
    })
  ),
}));

type Op = { table: string; method: string; args: unknown[] };
let ops: Op[];
let appointmentInsertError: { code: string; message: string } | null;

function builder(table: string) {
  let operation = "select";
  const self: Record<string, unknown> = {};
  for (const method of ["insert", "update", "delete", "select", "eq", "is", "neq", "lte", "gt", "not", "order"]) {
    self[method] = (...args: unknown[]) => {
      ops.push({ table, method, args });
      if (["insert", "update", "delete"].includes(method)) operation = method;
      return self;
    };
  }
  const result = () => {
    if (table === "services" && operation === "select") {
      return { data: { id: "svc-1", name: "Oil change", duration_minutes: 45 }, error: null };
    }
    if (table === "garage_customers" && operation === "insert") {
      return { data: { id: "cust-new", full_name: "Walk-in Wendy" }, error: null };
    }
    if (table === "vehicles" && operation === "insert") return { data: { id: "veh-new" }, error: null };
    if (table === "profiles" && operation === "select") {
      return { data: { id: "client-1", full_name: "Demo Client" }, error: null };
    }
    if (table === "appointments" && operation === "insert") {
      return appointmentInsertError
        ? { data: null, error: appointmentInsertError }
        : { data: { id: "appt-1", assigned_mechanic_id: "owner-1", mechanic: { full_name: "Owner" } }, error: null };
    }
    return { data: null, error: null };
  };
  self.single = () => Promise.resolve(result());
  self.maybeSingle = () => Promise.resolve(result());
  self.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return self;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ from: (table: string) => builder(table) })),
}));

const { createWalkIn } = await import("./walk-ins");

function form(fields: Record<string, string>) {
  const formData = new FormData();
  formData.set("lang", "en");
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const newWalkIn = {
  customerKind: "new",
  newName: "Walk-in Wendy",
  newPhone: "+352 691 000 000",
  vehicleChoice: "new",
  plate: "wi-777",
  model: "Clio",
  serviceId: "11111111-1111-4111-8111-111111111111",
  when: "now",
};

function inserted(table: string) {
  return ops.find((op) => op.table === table && op.method === "insert")?.args[0] as Record<string, unknown> | undefined;
}

beforeEach(() => {
  ops = [];
  appointmentInsertError = null;
  vi.useFakeTimers();
  // Wednesday 11 Nov 2026, 10:02 in Luxembourg (CET, UTC+1).
  vi.setSystemTime(new Date("2026-11-11T09:02:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createWalkIn", () => {
  it("creates the customer, their vehicle, and a confirmed job linked to both", async () => {
    const result = await createWalkIn(undefined, form(newWalkIn));

    expect(inserted("garage_customers")).toMatchObject({ garage_id: "garage-1", full_name: "Walk-in Wendy", created_by: "owner-1" });
    expect(inserted("vehicles")).toMatchObject({ garage_customer_id: "cust-new", license_plate: "wi-777", model: "Clio" });
    expect(inserted("appointments")).toMatchObject({
      garage_id: "garage-1",
      garage_customer_id: "cust-new",
      client_id: null,
      vehicle_id: "veh-new",
      status: "confirmed",
      assigned_mechanic_id: null,
    });
    expect(result?.created).toMatchObject({ appointmentId: "appt-1", customerName: "Walk-in Wendy", mechanicName: "Owner" });
  });

  it("rounds 'now' up to the next five minutes and uses the service duration", async () => {
    await createWalkIn(undefined, form(newWalkIn));

    const appointment = inserted("appointments");
    expect(appointment?.start_time).toBe("2026-11-11T09:05:00.000Z"); // 10:05 local
    expect(appointment?.end_time).toBe("2026-11-11T09:50:00.000Z"); // + 45 min
  });

  it("interprets 'later today' as Luxembourg wall-clock time", async () => {
    await createWalkIn(undefined, form({ ...newWalkIn, when: "at", time: "14:30" }));
    expect(inserted("appointments")?.start_time).toBe("2026-11-11T13:30:00.000Z");
  });

  it("rejects a time that has already passed, and one that runs past midnight", async () => {
    expect((await createWalkIn(undefined, form({ ...newWalkIn, when: "at", time: "08:00" })))?.errors?.time).toBeDefined();
    expect((await createWalkIn(undefined, form({ ...newWalkIn, when: "at", time: "23:45" })))?.errors?.time).toBeDefined();
    expect(inserted("appointments")).toBeUndefined();
    expect(inserted("garage_customers")).toBeUndefined();
  });

  it("books a returning registered client without creating anything for them", async () => {
    await createWalkIn(
      undefined,
      form({
        customerKind: "client",
        customerId: "22222222-2222-4222-8222-222222222222",
        vehicleChoice: "none",
        serviceId: newWalkIn.serviceId,
        when: "now",
      })
    );

    expect(inserted("garage_customers")).toBeUndefined();
    expect(inserted("vehicles")).toBeUndefined();
    expect(inserted("appointments")).toMatchObject({ client_id: "client-1", garage_customer_id: null });
  });

  it("refuses to create a vehicle for a registered client", async () => {
    const result = await createWalkIn(
      undefined,
      form({
        customerKind: "client",
        customerId: "22222222-2222-4222-8222-222222222222",
        vehicleChoice: "new",
        plate: "LU-1",
        serviceId: newWalkIn.serviceId,
      })
    );
    expect(result?.errors?.vehicleChoice).toBeDefined();
    expect(ops).toHaveLength(0);
  });

  it("requires a way to reach a new customer", async () => {
    const result = await createWalkIn(undefined, form({ ...newWalkIn, newPhone: "" }));
    expect(result?.errors?.newPhone).toBeDefined();
  });

  it("passes an explicit mechanic through for the DB to validate", async () => {
    await createWalkIn(undefined, form({ ...newWalkIn, mechanicId: "33333333-3333-4333-8333-333333333333" }));
    expect(inserted("appointments")?.assigned_mechanic_id).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("explains a busy mechanic and removes the customer/vehicle it just created", async () => {
    appointmentInsertError = { code: "23P01", message: "no_mechanic_available" };

    const result = await createWalkIn(undefined, form(newWalkIn));

    expect(result?.message).toMatch(/busy/i);
    const deletes = ops.filter((op) => op.method === "delete").map((op) => op.table);
    expect(deletes).toEqual(["vehicles", "garage_customers"]);
  });
});
