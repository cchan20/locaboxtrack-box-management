import {
  fetchBoxes,
  fetchCustomers,
  findCustomerByExternalId,
  findCustomerByName,
  incrementCustomerReturned,
  incrementCustomerTaken,
  initializeDatabase,
  insertTransaction,
  insertBox,
  insertCustomer,
  updateCustomerDetails,
  updateCustomerCreditCount,
  deleteCustomer,
  updateCustomerRiskStatus,
  updateBoxAvailability,
  updateBoxCheckin,
  updateBoxCheckout,
} from "../database/appDatabase";
import { Box, BoxStatus, Customer } from "@/types/app";
import { useAuth } from "@/store/AuthContext";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type DashboardStats = {
  totalBoxes: number;
  availableCount: number;
  safeCount: number;
  unavailableCount: number;
  checkedOutCount: number;
  warningCount: number;
  overdueCount: number;
};

type ImportedCustomerInput = {
  externalId: string;
  name: string;
  phone: string;
  email?: string;
};

type ImportCustomersResult = {
  ok: boolean;
  message: string;
  created: number;
  updated: number;
  skipped: number;
};

type AppDataContextValue = {
  isReady: boolean;
  boxes: Box[];
  customers: Customer[];
  refreshData: () => Promise<void>;
  dashboardStats: DashboardStats;
  getDaysOut: (dateString: string | null) => number;
  checkoutBox: (
    boxId: string,
    customerName: string,
    checkoutDate?: Date,
  ) => Promise<{ ok: boolean; message: string }>;
  checkinBox: (
    boxId: string,
    checkinDate?: Date,
  ) => Promise<{ ok: boolean; message: string }>;
  setBoxAvailability: (
    boxId: string,
    status: Extract<BoxStatus, "available" | "unavailable">,
  ) => Promise<{ ok: boolean; message: string }>;
  addBox: (boxId: string) => Promise<{ ok: boolean; message: string }>;
  addCustomer: (
    name: string,
    phone: string,
    email?: string,
  ) => Promise<{ ok: boolean; message: string }>;
  importCustomers: (
    rows: ImportedCustomerInput[],
  ) => Promise<ImportCustomersResult>;
  setCustomerRiskStatus: (
    customerId: string,
    riskStatus: Customer["riskStatus"],
  ) => Promise<{ ok: boolean; message: string }>;
  setCustomerCreditCount: (
    customerId: string,
    creditCount: number,
  ) => Promise<{ ok: boolean; message: string }>;
  updateCustomer: (
    customerId: string,
    name: string,
    phone: string,
    email?: string,
  ) => Promise<{ ok: boolean; message: string }>;
  deleteCustomerById: (
    customerId: string,
  ) => Promise<{ ok: boolean; message: string }>;
};

const AppDataContext = createContext<AppDataContextValue | undefined>(
  undefined,
);

const normalizeBoxId = (value: string): string => {
  const text = value.trim().toUpperCase();

  if (!text) {
    return "";
  }

  if (text.startsWith("BOX-")) {
    return text;
  }

  // If the input contains letters, it's already an alphanumeric ID (e.g. "L-1") — return as-is
  if (/[A-Z]/.test(text)) {
    return text;
  }

  const numeric = text.replace(/\D/g, "");

  if (!numeric) {
    return text;
  }

  return `BOX-${numeric.padStart(3, "0")}`;
};

const normalizeImportField = (value: string | undefined): string =>
  value?.trim() ?? "";

const createCustomerId = (): string =>
  `CUST-${Math.floor(10000 + Math.random() * 90000)}`;

export function AppDataProvider({ children }: PropsWithChildren) {
  const { loginUser } = useAuth();
  const [data, setData] = useState<{ boxes: Box[]; customers: Customer[] }>({
    boxes: [],
    customers: [],
  });
  const [isReady, setIsReady] = useState(false);

  const getDaysOut = (dateString: string | null): number => {
    if (!dateString) {
      return 0;
    }

    const diff = Date.now() - new Date(dateString).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const reloadData = useCallback(async () => {
    const [boxes, customers] = await Promise.all([
      fetchBoxes(),
      fetchCustomers(),
    ]);
    setData({ boxes, customers });
  }, []);

  useEffect(() => {
    const boot = async () => {
      await initializeDatabase();
      await reloadData();
      setIsReady(true);
    };

    boot();
  }, [reloadData]);

  const dashboardStats = useMemo<DashboardStats>(() => {
    const totalBoxes = data.boxes.length;
    const availableCount = data.boxes.filter(
      (box) => box.status === "available",
    ).length;
    const unavailableCount = data.boxes.filter(
      (box) => box.status === "unavailable",
    ).length;
    const checkedOutBoxes = data.boxes.filter(
      (box) => box.status === "checked-out",
    );
    const checkedOutCount = checkedOutBoxes.length;
    const safeCount = checkedOutBoxes.filter(
      (box) => getDaysOut(box.dateOut) <= 7,
    ).length;
    const warningCount = checkedOutBoxes.filter((box) => {
      const days = getDaysOut(box.dateOut);
      return days > 7 && days <= 14;
    }).length;
    const overdueCount = checkedOutBoxes.filter(
      (box) => getDaysOut(box.dateOut) > 14,
    ).length;

    return {
      totalBoxes,
      availableCount,
      unavailableCount,
      checkedOutCount,
      safeCount,
      warningCount,
      overdueCount,
    };
  }, [data.boxes]);

  const checkoutBox: AppDataContextValue["checkoutBox"] = async (
    boxId,
    customerName,
    checkoutDate,
  ) => {
    const id = normalizeBoxId(boxId);
    const name = customerName.trim();

    if (!id || !name) {
      return { ok: false, message: "Box and customer are required." };
    }

    const box = data.boxes.find((item) => item.id === id);

    if (!box) {
      return { ok: false, message: "Box not found." };
    }

    if (box.status === "checked-out") {
      return { ok: false, message: "Box is already checked out." };
    }

    if (box.status === "unavailable") {
      return { ok: false, message: "Box is unavailable." };
    }

    const customer = await findCustomerByName(name);
    await updateBoxCheckout(id, customer?.id ?? null, name, checkoutDate);

    await insertTransaction({
      boxId: id,
      customerId: customer?.id ?? "WALK-IN",
      userId: loginUser?.id ?? 0,
      type: "checkout",
      date: (checkoutDate ?? new Date()).getTime(),
    });

    if (customer?.id) {
      await incrementCustomerTaken(customer.id);
    }

    await reloadData();

    return { ok: true, message: `${id} assigned to ${name}.` };
  };

  const checkinBox: AppDataContextValue["checkinBox"] = async (
    boxId,
    checkinDate,
  ) => {
    const id = normalizeBoxId(boxId);

    if (!id) {
      return { ok: false, message: "Box ID is required." };
    }

    const box = data.boxes.find((item) => item.id === id);

    if (!box) {
      return { ok: false, message: "Box not found." };
    }

    if (box.status !== "checked-out") {
      return {
        ok: false,
        message:
          box.status === "available"
            ? "Box is already available."
            : "Unavailable boxes cannot be checked in.",
      };
    }

    const selectedCheckinDate = checkinDate ?? new Date();
    const checkoutDateValue = box.dateOut
      ? new Date(box.dateOut).getTime()
      : null;
    const daysOut = checkoutDateValue
      ? Math.max(
          0,
          Math.floor(
            (selectedCheckinDate.getTime() - checkoutDateValue) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;

    await insertTransaction({
      boxId: id,
      customerId: box.customerId ?? "WALK-IN",
      userId: loginUser?.id ?? 0,
      type: "return",
      date: selectedCheckinDate.getTime(),
    });

    await updateBoxCheckin(id);
    if (box.customerId) {
      await incrementCustomerReturned(box.customerId, daysOut > 14);
    }

    await reloadData();

    return {
      ok: true,
      message:
        daysOut > 14
          ? `${id} returned late (${daysOut} days).`
          : `${id} returned successfully.`,
    };
  };

  const addBox: AppDataContextValue["addBox"] = async (boxId) => {
    const id = normalizeBoxId(boxId);

    if (!id) {
      return { ok: false, message: "Please enter a box ID." };
    }

    if (data.boxes.some((box) => box.id === id)) {
      return { ok: false, message: "Box already exists." };
    }

    await insertBox({
      id,
      status: "available",
      customerId: null,
      customerName: null,
      dateOut: null,
    });

    await reloadData();

    return { ok: true, message: `${id} added.` };
  };

  const setBoxAvailability: AppDataContextValue["setBoxAvailability"] = async (
    boxId,
    status,
  ) => {
    const id = normalizeBoxId(boxId);
    const box = data.boxes.find((item) => item.id === id);

    if (!box) {
      return { ok: false, message: "Box not found." };
    }

    // if (box.status === "checked-out") {
    //   console.log(`Attempt to change availability of checked-out box ${id} to ${status} - operation not allowed.`);

    //   return { ok: false, message: "Checked-out boxes cannot be changed to unavailable." };
    // }

    if (box.status === status) {
      return { ok: true, message: `Box is already ${status}.` };
    }

    if (box.status === "checked-out" && status === "available") {
      return {
        ok: false,
        message: "Use check-in to return a checked-out box to available.",
      };
    }

    if (box.status === "unavailable" && status === "available") {
      if (box.customerId && box.customerName) {
        await updateBoxAvailability(id, "checked-out");
        await reloadData();
        return {
          ok: true,
          message: `${id} marked checked-out.`,
        };
      }
    }

    await updateBoxAvailability(id, status);
    await reloadData();

    return {
      ok: true,
      message:
        status === "unavailable"
          ? `${id} marked unavailable.`
          : `${id} marked available.`,
    };
  };

  const addCustomer: AppDataContextValue["addCustomer"] = async (
    name,
    phone,
    email,
  ) => {
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedName || !normalizedPhone) {
      return { ok: false, message: "Name and phone are required." };
    }

    await insertCustomer({
      id: createCustomerId(),
      name: normalizedName,
      phone: normalizedPhone,
      email: email?.trim() || "-",
      externalId: null,
      creditCount: 1,
      currentTaken: 0,
      totalTaken: 0,
      totalReturned: 0,
      lateReturns: 0,
      riskStatus: "low",
    });

    await reloadData();

    return { ok: true, message: `${normalizedName} added.` };
  };

  const importCustomers: AppDataContextValue["importCustomers"] = async (
    rows,
  ) => {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const externalId = normalizeImportField(row.externalId);
      const name = normalizeImportField(row.name);
      const phone = normalizeImportField(row.phone);
      const email = normalizeImportField(row.email) || "-";

      if (!externalId || !name || !phone) {
        skipped += 1;
        continue;
      }

      const existingCustomer =
        data.customers.find((item) => item.externalId === externalId) ??
        (await findCustomerByExternalId(externalId));

      if (!existingCustomer) {
        await insertCustomer({
          id: createCustomerId(),
          name,
          phone,
          email,
          externalId,
          creditCount: 1,
          currentTaken: 0,
          totalTaken: 0,
          totalReturned: 0,
          lateReturns: 0,
          riskStatus: "low",
        });
        created += 1;
        continue;
      }

      const hasChanges =
        existingCustomer.name !== name ||
        existingCustomer.phone !== phone ||
        existingCustomer.email !== email ||
        existingCustomer.externalId !== externalId;

      if (!hasChanges) {
        skipped += 1;
        continue;
      }

      await updateCustomerDetails({
        customerId: existingCustomer.id,
        name,
        phone,
        email,
        externalId,
      });
      updated += 1;
    }

    await reloadData();

    return {
      ok: true,
      message: `Import finished. Created ${created}, updated ${updated}, skipped ${skipped}.`,
      created,
      updated,
      skipped,
    };
  };

  const setCustomerRiskStatus: AppDataContextValue["setCustomerRiskStatus"] =
    async (customerId, riskStatus) => {
      const customer = data.customers.find((item) => item.id === customerId);

      if (!customer) {
        return { ok: false, message: "Customer not found." };
      }

      if (customer.riskStatus === riskStatus) {
        return { ok: true, message: "Risk status unchanged." };
      }

      await updateCustomerRiskStatus(customerId, riskStatus);
      await reloadData();

      return {
        ok: true,
        message: `${customer.name} risk set to ${riskStatus}.`,
      };
    };

  const setCustomerCreditCount: AppDataContextValue["setCustomerCreditCount"] =
    async (customerId, creditCount) => {
      const customer = data.customers.find((item) => item.id === customerId);

      if (!customer) {
        return { ok: false, message: "Customer not found." };
      }

      if (!Number.isFinite(creditCount) || creditCount < 1) {
        return {
          ok: false,
          message: "Credit must be a valid number greater than or equal to 1.",
        };
      }

      if (customer.creditCount === creditCount) {
        return { ok: true, message: "Credit unchanged." };
      }

      await updateCustomerCreditCount(customerId, creditCount);
      await reloadData();

      return {
        ok: true,
        message: `${customer.name} credit updated to ${creditCount}.`,
      };
    };

  const updateCustomer: AppDataContextValue["updateCustomer"] = async (
    customerId,
    name,
    phone,
    email,
  ) => {
    const customer = data.customers.find((item) => item.id === customerId);

    if (!customer) {
      return { ok: false, message: "Customer not found." };
    }

    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedName || !normalizedPhone) {
      return { ok: false, message: "Name and phone are required." };
    }

    await updateCustomerDetails({
      customerId,
      name: normalizedName,
      phone: normalizedPhone,
      email: email?.trim() || "-",
      externalId: customer.externalId,
    });

    await reloadData();

    return {
      ok: true,
      message: `${normalizedName} updated successfully.`,
    };
  };

  const deleteCustomerById: AppDataContextValue["deleteCustomerById"] = async (
    customerId,
  ) => {
    const customer = data.customers.find((item) => item.id === customerId);

    if (!customer) {
      return { ok: false, message: "Customer not found." };
    }

    const hasLinkedBox = data.boxes.some(
      (box) => box.customerId === customerId,
    );

    if (hasLinkedBox) {
      return {
        ok: false,
        message: "Cannot delete customer while linked to a box.",
      };
    }

    await deleteCustomer(customerId);
    await reloadData();

    return {
      ok: true,
      message: `${customer.name} deleted successfully.`,
    };
  };

  const value = useMemo<AppDataContextValue>(
    () => ({
      isReady,
      boxes: data.boxes,
      customers: data.customers,
      refreshData: reloadData,
      dashboardStats,
      getDaysOut,
      checkoutBox,
      checkinBox,
      setBoxAvailability,
      addBox,
      addCustomer,
      importCustomers,
      setCustomerRiskStatus,
      setCustomerCreditCount,
      updateCustomer,
      deleteCustomerById,
    }),
    [isReady, data.boxes, data.customers, dashboardStats, reloadData],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData must be used within AppDataProvider");
  }

  return context;
}
