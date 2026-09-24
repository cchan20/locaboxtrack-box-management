import axiosInstance from "@/store/utility/axiosInstance";
import { DailyMealDto, mapDailyMeal } from "@/store/utility/mappers";
import { DailyMeal, DailyMealInput } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type DailyMealState = {
  meals: DailyMeal[];
  loading: boolean;
  error: string | null;
};

const initialState: DailyMealState = {
  meals: [],
  loading: false,
  error: null,
};

export type GetDailyMealsParams = {
  from: string;
  to: string;
};

export const getDailyMeals = createAsyncThunk(
  "getDailyMeals",
  async (params: GetDailyMealsParams) => {
    try {
      const query = new URLSearchParams();
      query.set("from", params.from);
      query.set("to", params.to);
      const response = await axiosInstance.get<DailyMealDto[]>(
        `daily-meals?${query.toString()}`,
      );
      return { data: (response.data ?? []).map(mapDailyMeal) };
    } catch (error) {
      throw error;
    }
  },
);

export const batchInsertDailyMeals = createAsyncThunk(
  "batchInsertDailyMeals",
  async (meals: DailyMealInput[]) => {
    try {
      const response = await axiosInstance.post<DailyMealDto[]>("daily-meals/batch", {
        meals,
      });
      return { data: (response.data ?? []).map(mapDailyMeal) };
    } catch (error) {
      throw error;
    }
  },
);

export const batchUpdateDailyMeals = createAsyncThunk(
  "batchUpdateDailyMeals",
  async (meals: DailyMealInput[]) => {
    try {
      const response = await axiosInstance.put<DailyMealDto[]>("daily-meals/batch", {
        meals,
      });
      return { data: (response.data ?? []).map(mapDailyMeal) };
    } catch (error) {
      throw error;
    }
  },
);

export const downloadDailyMealsTemplate = createAsyncThunk(
  "downloadDailyMealsTemplate",
  async () => {
    try {
      const response = await axiosInstance.get<string>("daily-meals/template.csv", {
        responseType: "text",
        headers: {
          Accept: "text/csv",
        },
      });
      return { data: typeof response.data === "string" ? response.data : String(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

const dailyMealSlice = createSlice({
  name: "dailyMeal",
  initialState,
  reducers: {
    clearDailyMeals(state) {
      state.meals = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const setPending = (state: DailyMealState) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state: DailyMealState, action: PayloadAction<any>) => {
      state.loading = false;
      state.error =
        action.payload?.error?.message ??
        action.payload?.message ??
        "Request failed";
    };

    builder.addCase(getDailyMeals.pending, setPending);
    builder.addCase(getDailyMeals.fulfilled, (state, action) => {
      state.loading = false;
      state.meals = action.payload.data;
    });
    builder.addCase(getDailyMeals.rejected, setRejected);

    builder.addCase(batchInsertDailyMeals.pending, setPending);
    builder.addCase(batchInsertDailyMeals.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(batchInsertDailyMeals.rejected, setRejected);

    builder.addCase(batchUpdateDailyMeals.pending, setPending);
    builder.addCase(batchUpdateDailyMeals.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(batchUpdateDailyMeals.rejected, setRejected);
  },
});

export const { clearDailyMeals } = dailyMealSlice.actions;
export default dailyMealSlice.reducer;
