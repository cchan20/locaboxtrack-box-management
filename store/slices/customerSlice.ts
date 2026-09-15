import axiosInstance from "@/store/utility/axiosInstance";
import { CustomerDto, mapCustomer } from "@/store/utility/mappers";
import { Customer } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type CustomerState = {
  customers: Customer[];
  selectedCustomer: Customer | null;
  loading: boolean;
  error: string | null;
};

const initialState: CustomerState = {
  customers: [],
  selectedCustomer: null,
  loading: false,
  error: null,
};

export const getCustomers = createAsyncThunk(
  "getCustomers",
  async (search?: string) => {
    try {
      const query = search?.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const url = `customers${query}`;
      const response = await axiosInstance.get<CustomerDto[]>(url);
      return { data: response.data.map(mapCustomer) };
    } catch (error) {
      throw error;
    }
  },
);

export const getCustomerById = createAsyncThunk(
  "getCustomerById",
  async (id: string) => {
    try {
      const url = `customers/${encodeURIComponent(id)}`;
      const response = await axiosInstance.get<CustomerDto>(url);
      return { data: mapCustomer(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const createCustomer = createAsyncThunk(
  "createCustomer",
  async (payload: {
    name: string;
    phone: string;
    email: string;
    externalId?: string;
  }) => {
    try {
      const url = "customers";
      const response = await axiosInstance.post<CustomerDto>(url, payload);
      return { data: mapCustomer(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const updateCustomer = createAsyncThunk(
  "updateCustomer",
  async (payload: {
    id: string;
    name: string;
    phone: string;
    email: string;
    externalId?: string | null;
  }) => {
    try {
      const { id, ...body } = payload;
      const url = `customers/${encodeURIComponent(id)}`;
      const response = await axiosInstance.put<CustomerDto>(url, {
        name: body.name,
        phone: body.phone,
        email: body.email,
        ...(body.externalId != null ? { externalId: body.externalId } : {}),
      });
      return { data: mapCustomer(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const setCustomerRiskStatus = createAsyncThunk(
  "setCustomerRiskStatus",
  async (payload: { id: string; riskStatus: Customer["riskStatus"] }) => {
    try {
      const url = `customers/${encodeURIComponent(payload.id)}/risk-status`;
      const response = await axiosInstance.put<CustomerDto>(url, {
        riskStatus: payload.riskStatus,
      });
      return { data: mapCustomer(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const setCustomerCreditCount = createAsyncThunk(
  "setCustomerCreditCount",
  async (payload: { id: string; creditCount: number }) => {
    try {
      const url = `customers/${encodeURIComponent(payload.id)}/credit-count`;
      const response = await axiosInstance.put<CustomerDto>(url, {
        creditCount: payload.creditCount,
      });
      return { data: mapCustomer(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const deleteCustomer = createAsyncThunk(
  "deleteCustomer",
  async (id: string) => {
    try {
      const url = `customers/${encodeURIComponent(id)}`;
      const response = await axiosInstance.delete<{ deleted: boolean }>(url);
      return { data: response.data };
    } catch (error) {
      throw error;
    }
  },
);

const customerSlice = createSlice({
  name: "customer",
  initialState,
  reducers: {
    clearSelectedCustomer(state) {
      state.selectedCustomer = null;
    },
  },
  extraReducers: (builder) => {
    const setPending = (state: CustomerState) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state: CustomerState, action: PayloadAction<any>) => {
      state.loading = false;
      state.error =
        action.payload?.error?.message ??
        action.payload?.message ??
        "Request failed";
    };

    builder.addCase(getCustomers.pending, setPending);
    builder.addCase(getCustomers.fulfilled, (state, action) => {
      state.loading = false;
      state.customers = action.payload.data;
    });
    builder.addCase(getCustomers.rejected, setRejected);

    builder.addCase(getCustomerById.pending, setPending);
    builder.addCase(getCustomerById.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedCustomer = action.payload.data;
    });
    builder.addCase(getCustomerById.rejected, setRejected);

    builder.addCase(createCustomer.pending, setPending);
    builder.addCase(createCustomer.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(createCustomer.rejected, setRejected);

    builder.addCase(updateCustomer.pending, setPending);
    builder.addCase(updateCustomer.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedCustomer = action.payload.data;
    });
    builder.addCase(updateCustomer.rejected, setRejected);

    builder.addCase(setCustomerRiskStatus.pending, setPending);
    builder.addCase(setCustomerRiskStatus.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedCustomer = action.payload.data;
    });
    builder.addCase(setCustomerRiskStatus.rejected, setRejected);

    builder.addCase(setCustomerCreditCount.pending, setPending);
    builder.addCase(setCustomerCreditCount.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedCustomer = action.payload.data;
    });
    builder.addCase(setCustomerCreditCount.rejected, setRejected);

    builder.addCase(deleteCustomer.pending, setPending);
    builder.addCase(deleteCustomer.fulfilled, (state) => {
      state.loading = false;
      state.selectedCustomer = null;
    });
    builder.addCase(deleteCustomer.rejected, setRejected);
  },
});

export const { clearSelectedCustomer } = customerSlice.actions;
export default customerSlice.reducer;
