import axiosInstance from "@/store/utility/axiosInstance";
import { TransactionDto, mapTransaction } from "@/store/utility/mappers";
import { TransactionHistoryItem } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type TransactionState = {
  transactions: TransactionHistoryItem[];
  loading: boolean;
  error: string | null;
};

const initialState: TransactionState = {
  transactions: [],
  loading: false,
  error: null,
};

export const getTransactionsByBox = createAsyncThunk(
  "getTransactionsByBox",
  async (payload: { boxId: string; limit?: number }) => {
    try {
      const query = payload.limit ? `?limit=${payload.limit}` : "";
      const url = `transactions/box/${encodeURIComponent(payload.boxId)}${query}`;
      const response = await axiosInstance.get<TransactionDto[]>(url);
      return { data: response.data.map(mapTransaction) };
    } catch (error) {
      throw error;
    }
  },
);

export const getTransactionsByCustomer = createAsyncThunk(
  "getTransactionsByCustomer",
  async (payload: { customerId: string; limit?: number }) => {
    try {
      const query = payload.limit ? `?limit=${payload.limit}` : "";
      const url = `transactions/customer/${encodeURIComponent(payload.customerId)}${query}`;
      const response = await axiosInstance.get<TransactionDto[]>(url);
      return { data: response.data.map(mapTransaction) };
    } catch (error) {
      throw error;
    }
  },
);

export const getTransactionsSince = createAsyncThunk(
  "getTransactionsSince",
  async (since: number) => {
    try {
      const url = `transactions?since=${since}`;
      const response = await axiosInstance.get<TransactionDto[]>(url);
      return { data: response.data.map(mapTransaction) };
    } catch (error) {
      throw error;
    }
  },
);

const transactionSlice = createSlice({
  name: "transaction",
  initialState,
  reducers: {
    clearTransactions(state) {
      state.transactions = [];
    },
  },
  extraReducers: (builder) => {
    const setPending = (state: TransactionState) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state: TransactionState, action: PayloadAction<any>) => {
      state.loading = false;
      state.error =
        action.payload?.error?.message ??
        action.payload?.message ??
        "Request failed";
    };

    builder.addCase(getTransactionsByBox.pending, setPending);
    builder.addCase(getTransactionsByBox.fulfilled, (state, action) => {
      state.loading = false;
      state.transactions = action.payload.data;
    });
    builder.addCase(getTransactionsByBox.rejected, setRejected);

    builder.addCase(getTransactionsByCustomer.pending, setPending);
    builder.addCase(getTransactionsByCustomer.fulfilled, (state, action) => {
      state.loading = false;
      state.transactions = action.payload.data;
    });
    builder.addCase(getTransactionsByCustomer.rejected, setRejected);

    builder.addCase(getTransactionsSince.pending, setPending);
    builder.addCase(getTransactionsSince.fulfilled, (state, action) => {
      state.loading = false;
      state.transactions = action.payload.data;
    });
    builder.addCase(getTransactionsSince.rejected, setRejected);
  },
});

export const { clearTransactions } = transactionSlice.actions;
export default transactionSlice.reducer;
