import axiosInstance from "@/store/utility/axiosInstance";
import { OrderDto, mapOrder } from "@/store/utility/mappers";
import { Order } from "@/types/app";
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
  },
});

export const { clearOrders } = orderSlice.actions;
export default orderSlice.reducer;
