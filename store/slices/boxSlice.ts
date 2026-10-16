import axiosInstance from "@/store/utility/axiosInstance";
import {
  BoxDto,
  CheckedOutBoxDetailDto,
  mapBox,
  mapCheckedOutDetail,
} from "@/store/utility/mappers";
import { Box, BoxStatus, CheckedOutBoxDetails } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type BoxState = {
  boxes: Box[];
  availableBoxes: Box[];
  checkedOutBoxes: Box[];
  checkedOutDetails: CheckedOutBoxDetails[];
  selectedBox: Box | null;
  loading: boolean;
  error: string | null;
};

const initialState: BoxState = {
  boxes: [],
  availableBoxes: [],
  checkedOutBoxes: [],
  checkedOutDetails: [],
  selectedBox: null,
  loading: false,
  error: null,
};

export type GetBoxesParams = {
  status?: BoxStatus[];
  search?: string;
  page?: number;
  limit?: number;
};

export type GetBoxesResult = {
  data: Box[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

type GetBoxesApiResponse = {
  data: BoxDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

function buildBoxesQuery(params?: GetBoxesParams): string {
  const query = new URLSearchParams();

  if (params?.status?.length) {
    query.set("status", params.status.join(","));
  }

  if (params?.search?.trim()) {
    query.set("search", params.search.trim());
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

export const getBoxes = createAsyncThunk(
  "getBoxes",
  async (params?: GetBoxesParams) => {
    try {
      const url = `boxes${buildBoxesQuery(params)}`;
      const response = await axiosInstance.get<GetBoxesApiResponse>(url);
      return {
        data: (response.data.data ?? []).map(mapBox),
        page: response.data.page,
        limit: response.data.limit,
        total: response.data.total,
        hasMore: response.data.hasMore,
      } satisfies GetBoxesResult;
    } catch (error) {
      throw error;
    }
  },
);

export const getAvailableBoxes = createAsyncThunk(
  "getAvailableBoxes",
  async (search?: string) => {
    try {
      const query = search?.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const url = `boxes/available${query}`;
      const response = await axiosInstance.get<BoxDto[]>(url);
      return { data: response.data.map(mapBox) };
    } catch (error) {
      throw error;
    }
  },
);

export const getCheckedOutBoxes = createAsyncThunk(
  "getCheckedOutBoxes",
  async (search?: string) => {
    try {
      const query = search?.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";
      const url = `boxes/checked-out${query}`;
      const response = await axiosInstance.get<BoxDto[]>(url);
      return { data: response.data.map(mapBox) };
    } catch (error) {
      throw error;
    }
  },
);

export const getCheckedOutBoxDetails = createAsyncThunk(
  "getCheckedOutBoxDetails",
  async () => {
    try {
      const url = "boxes/checked-out/details";
      const response = await axiosInstance.get<CheckedOutBoxDetailDto[]>(url);
      return { data: response.data.map(mapCheckedOutDetail) };
    } catch (error) {
      throw error;
    }
  },
);

export const getBoxById = createAsyncThunk("getBoxById", async (id: string) => {
  try {
    const url = `boxes/${encodeURIComponent(id)}`;
    const response = await axiosInstance.get<BoxDto>(url);
    return { data: mapBox(response.data) };
  } catch (error) {
    throw error;
  }
});

export const checkoutBox = createAsyncThunk(
  "checkoutBox",
  async (payload: { boxId: string; customerName: string; checkoutDate?: string }) => {
    try {
      const url = "boxes/checkout";
      const response = await axiosInstance.post<{ box: BoxDto }>(url, payload);
      return {
        data: { box: mapBox(response.data.box) },
      };
    } catch (error) {
      throw error;
    }
  },
);

export const checkinBox = createAsyncThunk(
  "checkinBox",
  async (payload: { boxId: string; checkinDate?: string }) => {
    try {
      const url = "boxes/checkin";
      const response = await axiosInstance.post<{
        box: BoxDto;
        isLate: boolean;
        daysOut: number;
      }>(url, payload);
      return {
        data: {
          box: mapBox(response.data.box),
          isLate: response.data.isLate,
          daysOut: response.data.daysOut,
        },
      };
    } catch (error) {
      throw error;
    }
  },
);

export const setBoxAvailability = createAsyncThunk(
  "setBoxAvailability",
  async (payload: { boxId: string; status: BoxStatus }) => {
    try {
      const url = `boxes/${encodeURIComponent(payload.boxId)}/availability`;
      const response = await axiosInstance.put<BoxDto>(url, {
        status: payload.status,
      });
      return { data: mapBox(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export type ImportBoxesPayload = {
  boxes: Array<{ id: string; status: BoxStatus }>;
};

export type ImportBoxesResult = {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  total: number;
};

export const importBoxes = createAsyncThunk(
  "importBoxes",
  async (payload: ImportBoxesPayload) => {
    try {
      const response = await axiosInstance.post<ImportBoxesResult>("boxes/import", payload);
      return { data: response.data };
    } catch (error) {
      throw error;
    }
  },
);

const boxSlice = createSlice({
  name: "box",
  initialState,
  reducers: {
    clearSelectedBox(state) {
      state.selectedBox = null;
    },
  },
  extraReducers: (builder) => {
    const setPending = (state: BoxState) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state: BoxState, action: PayloadAction<any>) => {
      state.loading = false;
      state.error =
        action.payload?.error?.message ??
        action.payload?.message ??
        "Request failed";
    };

    builder.addCase(getBoxes.pending, setPending);
    builder.addCase(getBoxes.fulfilled, (state, action) => {
      state.loading = false;
      state.boxes = action.payload.data;
    });
    builder.addCase(getBoxes.rejected, setRejected);

    builder.addCase(getAvailableBoxes.pending, setPending);
    builder.addCase(getAvailableBoxes.fulfilled, (state, action) => {
      state.loading = false;
      state.availableBoxes = action.payload.data;
    });
    builder.addCase(getAvailableBoxes.rejected, setRejected);

    builder.addCase(getCheckedOutBoxes.pending, setPending);
    builder.addCase(getCheckedOutBoxes.fulfilled, (state, action) => {
      state.loading = false;
      state.checkedOutBoxes = action.payload.data;
    });
    builder.addCase(getCheckedOutBoxes.rejected, setRejected);

    builder.addCase(getCheckedOutBoxDetails.pending, setPending);
    builder.addCase(getCheckedOutBoxDetails.fulfilled, (state, action) => {
      state.loading = false;
      state.checkedOutDetails = action.payload.data;
    });
    builder.addCase(getCheckedOutBoxDetails.rejected, setRejected);

    builder.addCase(getBoxById.pending, setPending);
    builder.addCase(getBoxById.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedBox = action.payload.data;
    });
    builder.addCase(getBoxById.rejected, setRejected);

    builder.addCase(checkoutBox.pending, setPending);
    builder.addCase(checkoutBox.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(checkoutBox.rejected, setRejected);

    builder.addCase(checkinBox.pending, setPending);
    builder.addCase(checkinBox.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(checkinBox.rejected, setRejected);

    builder.addCase(setBoxAvailability.pending, setPending);
    builder.addCase(setBoxAvailability.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedBox = action.payload.data;
    });
    builder.addCase(setBoxAvailability.rejected, setRejected);

    builder.addCase(importBoxes.pending, setPending);
    builder.addCase(importBoxes.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(importBoxes.rejected, setRejected);
  },
});

export const { clearSelectedBox } = boxSlice.actions;
export default boxSlice.reducer;
