import axiosInstance from "@/store/utility/axiosInstance";
import { OrderDto, mapOrder } from "@/store/utility/mappers";
import { DayAvailability, Order, UpsertOrderPayload } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type OrderState = {
  orders: Order[];
  loading: boolean;
  error: string | null;
};

const initialState: OrderState = {
  orders: [],
  loading: false,
  error: null,
};

export type GetOrdersParams = {
  from: string;
  to: string;
  timeslotId?: string;
  storeLocationId?: string;
};

export type UpsertOrderForCustomerParams = {
  customerId: string;
  date: string;
  payload: UpsertOrderPayload;
};

export type GetAvailabilityParams = {
  from: string;
  to: string;
};

function buildOrdersQuery(params: GetOrdersParams): string {
  const query = new URLSearchParams();
  query.set("from", params.from);
  query.set("to", params.to);

  if (params.timeslotId?.trim()) {
    query.set("timeslotId", params.timeslotId.trim());
  }

  if (params.storeLocationId?.trim()) {
    query.set("storeLocationId", params.storeLocationId.trim());
  }

  return `?${query.toString()}`;
}

export const getOrders = createAsyncThunk(
  "getOrders",
  async (params: GetOrdersParams) => {
    try {
      const url = `orders${buildOrdersQuery(params)}`;
      const response = await axiosInstance.get<OrderDto[]>(url);
      return { data: (response.data ?? []).map(mapOrder) };
    } catch (error) {
      throw error;
    }
  },
);

export const upsertOrderForCustomer = createAsyncThunk(
  "upsertOrderForCustomer",
  async ({ customerId, date, payload }: UpsertOrderForCustomerParams) => {
    try {
      const response = await axiosInstance.put<OrderDto>(
        `orders/${encodeURIComponent(customerId)}/${encodeURIComponent(date)}`,
        payload,
      );
      return { data: mapOrder(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export type CancelOrderForCustomerParams = {
  customerId: string;
  date: string;
  orderId?: string;
};

export const cancelOrderForCustomer = createAsyncThunk(
  "cancelOrderForCustomer",
  async ({ customerId, date, orderId }: CancelOrderForCustomerParams) => {
    try {
      const query = orderId?.trim()
        ? `?orderId=${encodeURIComponent(orderId.trim())}`
        : "";
      await axiosInstance.delete(
        `orders/${encodeURIComponent(customerId)}/${encodeURIComponent(date)}${query}`,
      );
      return { customerId, date };
    } catch (error) {
      throw error;
    }
  },
);

export type MarkOrderPickedParams = {
  customerId: string;
  date: string;
  boxIds: string[];
  orderId?: string;
};

export const markOrderPicked = createAsyncThunk(
  "markOrderPicked",
  async ({ customerId, date, boxIds, orderId }: MarkOrderPickedParams) => {
    try {
      const query = orderId?.trim()
        ? `?orderId=${encodeURIComponent(orderId.trim())}`
        : "";
      const response = await axiosInstance.post<OrderDto>(
        `orders/${encodeURIComponent(customerId)}/${encodeURIComponent(date)}/picked${query}`,
        { boxIds },
      );
      return { data: mapOrder(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export type MarkOrderPaidParams = {
  customerId: string;
  date: string;
  orderId?: string;
};

export const markOrderPaid = createAsyncThunk(
  "markOrderPaid",
  async ({ customerId, date, orderId }: MarkOrderPaidParams) => {
    try {
      const query = orderId?.trim()
        ? `?orderId=${encodeURIComponent(orderId.trim())}`
        : "";
      const response = await axiosInstance.post<OrderDto>(
        `orders/${encodeURIComponent(customerId)}/${encodeURIComponent(date)}/paid${query}`,
      );
      return { data: mapOrder(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export type MarkOrderUnpaidParams = {
  customerId: string;
  date: string;
  orderId?: string;
};

export const markOrderUnpaid = createAsyncThunk(
  "markOrderUnpaid",
  async ({ customerId, date, orderId }: MarkOrderUnpaidParams) => {
    try {
      const query = orderId?.trim()
        ? `?orderId=${encodeURIComponent(orderId.trim())}`
        : "";
      const response = await axiosInstance.post<OrderDto>(
        `orders/${encodeURIComponent(customerId)}/${encodeURIComponent(date)}/unpaid${query}`,
      );
      return { data: mapOrder(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const getAvailability = createAsyncThunk(
  "getAvailability",
  async (params: GetAvailabilityParams) => {
    try {
      const query = new URLSearchParams();
      query.set("from", params.from);
      query.set("to", params.to);
      const response = await axiosInstance.get<DayAvailability[]>(
        `inventory/availability?${query.toString()}`,
      );
      return { data: response.data ?? [] };
    } catch (error) {
      throw error;
    }
  },
);

const orderSlice = createSlice({
  name: "order",
  initialState,
  reducers: {
    clearOrders(state) {
      state.orders = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const setPending = (state: OrderState) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state: OrderState, action: PayloadAction<any>) => {
      state.loading = false;
      state.error =
        action.payload?.error?.message ??
        action.payload?.message ??
        "Request failed";
    };

    builder.addCase(getOrders.pending, setPending);
    builder.addCase(getOrders.fulfilled, (state, action) => {
      state.loading = false;
      state.orders = action.payload.data;
    });
    builder.addCase(getOrders.rejected, setRejected);

    builder.addCase(upsertOrderForCustomer.pending, setPending);
    builder.addCase(upsertOrderForCustomer.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(upsertOrderForCustomer.rejected, setRejected);

    builder.addCase(cancelOrderForCustomer.fulfilled, (state, action) => {
      const { customerId, date } = action.payload;
      const order = state.orders.find(
        (item) => item.customerId === customerId && item.date === date,
      );
      if (order) {
        order.status = "cancelled";
      }
    });

    builder.addCase(markOrderPicked.fulfilled, (state, action) => {
      const updated = action.payload.data;
      const index = state.orders.findIndex((item) => item.id === updated.id);
      if (index >= 0) {
        state.orders[index] = updated;
      }
    });

    builder.addCase(markOrderPaid.fulfilled, (state, action) => {
      const updated = action.payload.data;
      const index = state.orders.findIndex((item) => item.id === updated.id);
      if (index >= 0) {
        state.orders[index] = updated;
      }
    });

    builder.addCase(markOrderUnpaid.fulfilled, (state, action) => {
      const updated = action.payload.data;
      const index = state.orders.findIndex((item) => item.id === updated.id);
      if (index >= 0) {
        state.orders[index] = updated;
      }
    });
  },
});

export const { clearOrders } = orderSlice.actions;
export default orderSlice.reducer;
