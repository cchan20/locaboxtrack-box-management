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

export type GetCustomersParams = {
  search?: string;
  name?: string;
  phone?: string;
  email?: string;
  page?: number;
  limit?: number;
};

export type GetCustomersResult = {
  data: Customer[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

type GetCustomersApiResponse = {
  data: CustomerDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

function buildCustomersQuery(params?: GetCustomersParams): string {
  const query = new URLSearchParams();
  const search = params?.search?.trim();
  const name = params?.name?.trim();
  const phone = params?.phone?.trim();
  const email = params?.email?.trim();

  if (search) {
    query.set("search", search);
  }
  if (name) {
    query.set("name", name);
  }
  if (phone) {
    query.set("phone", phone);
  }
  if (email) {
    query.set("email", email);
  }
  if (params?.page != null && params.page > 0) {
    query.set("page", String(params.page));
  }
  if (params?.limit != null && params.limit > 0) {
    query.set("limit", String(params.limit));
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export const getCustomers = createAsyncThunk(
  "getCustomers",
  async (params?: GetCustomersParams | string) => {
    try {
      const normalized: GetCustomersParams | undefined =
        typeof params === "string" ? { search: params } : params;
      const url = `customers${buildCustomersQuery(normalized)}`;
      const response = await axiosInstance.get<GetCustomersApiResponse>(url);
      return {
        data: (response.data.data ?? []).map(mapCustomer),
        page: response.data.page,
        limit: response.data.limit,
        total: response.data.total,
        hasMore: response.data.hasMore,
      } satisfies GetCustomersResult;
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
