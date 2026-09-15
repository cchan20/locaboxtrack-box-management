import axiosInstance from "@/store/utility/axiosInstance";
import { PrefixDto, mapPrefix } from "@/store/utility/mappers";
import { RunningNoControl } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type PrefixState = {
  prefixes: RunningNoControl[];
  loading: boolean;
  error: string | null;
};

const initialState: PrefixState = {
  prefixes: [],
  loading: false,
  error: null,
};

export const getPrefixes = createAsyncThunk("getPrefixes", async () => {
  try {
    const url = "prefixes";
    const response = await axiosInstance.get<PrefixDto[]>(url);
    return { data: response.data.map(mapPrefix) };
  } catch (error) {
    throw error;
  }
});

export const createPrefix = createAsyncThunk(
  "createPrefix",
  async (payload: { prefix: string }) => {
    try {
      const url = "prefixes";
      const response = await axiosInstance.post<PrefixDto>(url, payload);
      return { data: mapPrefix(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const deletePrefix = createAsyncThunk(
  "deletePrefix",
  async (id: string) => {
    try {
      const url = `prefixes/${encodeURIComponent(id)}`;
      const response = await axiosInstance.delete<{ deleted: boolean }>(url);
      return { data: response.data };
    } catch (error) {
      throw error;
    }
  },
);

export const generateBoxes = createAsyncThunk(
  "generateBoxes",
  async (payload: { prefixId: string; count: number }) => {
    try {
      const url = `prefixes/${encodeURIComponent(payload.prefixId)}/generate-boxes`;
      const response = await axiosInstance.post<{
        createdCount: number;
        lastNumber: number;
      }>(url, { count: payload.count });
      return { data: response.data };
    } catch (error) {
      throw error;
    }
  },
);

const prefixSlice = createSlice({
  name: "prefix",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const setPending = (state: PrefixState) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state: PrefixState, action: PayloadAction<any>) => {
      state.loading = false;
      state.error =
        action.payload?.error?.message ??
        action.payload?.message ??
        "Request failed";
    };

    builder.addCase(getPrefixes.pending, setPending);
    builder.addCase(getPrefixes.fulfilled, (state, action) => {
      state.loading = false;
      state.prefixes = action.payload.data;
    });
    builder.addCase(getPrefixes.rejected, setRejected);

    builder.addCase(createPrefix.pending, setPending);
    builder.addCase(createPrefix.fulfilled, (state, action) => {
      state.loading = false;
      state.prefixes = [...state.prefixes, action.payload.data];
    });
    builder.addCase(createPrefix.rejected, setRejected);

    builder.addCase(deletePrefix.pending, setPending);
    builder.addCase(deletePrefix.fulfilled, (state, action) => {
      state.loading = false;
      const deletedId = action.meta.arg;
      state.prefixes = state.prefixes.filter((item) => item.id !== deletedId);
    });
    builder.addCase(deletePrefix.rejected, setRejected);

    builder.addCase(generateBoxes.pending, setPending);
    builder.addCase(generateBoxes.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(generateBoxes.rejected, setRejected);
  },
});

export default prefixSlice.reducer;
