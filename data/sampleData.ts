import { Box, Customer } from "@/types/app";

const buildInitialBoxes = (): Box[] => {
  const boxes: Box[] = [];

  for (let i = 1; i <= 50; i += 1) {
    boxes.push({
      id: `BOX-${String(i).padStart(3, "0")}`,
      status: "available",
      customerId: null,
      customerName: null,
      dateOut: null,
    });
  }

  return boxes;
};

const DEPOSIT_CUSTOMER: Customer = {
  id: "CUST-DEPOSIT",
  name: "Deposit",
  phone: "N/A",
  email: "-",
  externalId: null,
  totalTaken: 0,
  totalReturned: 0,
  lateReturns: 0,
  riskStatus: "low",
};

export const getInitialData = (): { boxes: Box[]; customers: Customer[] } => ({
  boxes: buildInitialBoxes(),
  customers: [DEPOSIT_CUSTOMER],
});
