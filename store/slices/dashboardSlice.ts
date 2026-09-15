import axiosInstance from "@/store/utility/axiosInstance";
import { DashboardStats } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type DashboardState = {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
};

const initialState: DashboardState = {
  stats: null,
  loading: false,
  error: null,
};

export const getDashboardStats = createAsyncThunk(
  "getDashboardStats",
  async () => {
    try {
      const url = "dashboard/stats";
      const response = await axiosInstance.get<DashboardStats>(url);
      return { data: response.data };
    } catch (error) {
      throw error;
    }
  },
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getDashboardStats.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getDashboardStats.fulfilled, (state, action) => {
      state.loading = false;
      state.stats = action.payload.data;
    });
    builder.addCase(
      getDashboardStats.rejected,
      (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.error =
          action.payload?.error?.message ??
          action.payload?.message ??
          "Request failed";
      },
    );
  },
});

export default dashboardSlice.reducer;
