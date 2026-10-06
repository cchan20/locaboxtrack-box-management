import axiosInstance from "@/store/utility/axiosInstance";
import {
  GlobalSettingDto,
  mapGlobalSetting,
} from "@/store/utility/mappers";
import { GlobalSetting, StoreLocation, Timeslot } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type SettingsState = {
  settings: GlobalSetting | null;
  loading: boolean;
  error: string | null;
};

const initialState: SettingsState = {
  settings: null,
  loading: false,
  error: null,
};

export const getGlobalSettings = createAsyncThunk("getGlobalSettings", async () => {
  try {
    const response = await axiosInstance.get<GlobalSettingDto>("settings");
    return { data: mapGlobalSetting(response.data) };
  } catch (error) {
    throw error;
  }
});

export const updateStoreLocations = createAsyncThunk(
  "updateStoreLocations",
  async (storeLocations: StoreLocation[]) => {
    try {
      const response = await axiosInstance.put<GlobalSettingDto>(
        "settings/store-locations",
        { storeLocations },
      );
      return { data: mapGlobalSetting(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const updateTimeslots = createAsyncThunk(
  "updateTimeslots",
  async (timeslots: Timeslot[]) => {
    try {
      const response = await axiosInstance.put<GlobalSettingDto>("settings/timeslots", {
        timeslots: timeslots.map((slot) => ({
          id: slot.id,
          label: slot.label,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
        })),
      });
      return { data: mapGlobalSetting(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const updateWelcomeMessage = createAsyncThunk(
  "updateWelcomeMessage",
  async (welcomeMessage: string) => {
    try {
      const response = await axiosInstance.put<GlobalSettingDto>(
        "settings/welcome-message",
        { welcomeMessage },
      );
      return { data: mapGlobalSetting(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const updateOrderWhatsappNumber = createAsyncThunk(
  "updateOrderWhatsappNumber",
  async (orderWhatsappNumber: string) => {
    try {
      const response = await axiosInstance.put<GlobalSettingDto>(
        "settings/whatsapp-number",
        { orderWhatsappNumber },
      );
      return { data: mapGlobalSetting(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const setPending = (state: SettingsState) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state: SettingsState, action: PayloadAction<any>) => {
      state.loading = false;
      state.error =
        action.payload?.error?.message ??
        action.payload?.message ??
        "Request failed";
    };
    const setFulfilledSettings = (
      state: SettingsState,
      action: { payload: { data: GlobalSetting } },
    ) => {
      state.loading = false;
      state.settings = action.payload.data;
    };

    builder.addCase(getGlobalSettings.pending, setPending);
    builder.addCase(getGlobalSettings.fulfilled, setFulfilledSettings);
    builder.addCase(getGlobalSettings.rejected, setRejected);

    builder.addCase(updateStoreLocations.pending, setPending);
    builder.addCase(updateStoreLocations.fulfilled, setFulfilledSettings);
    builder.addCase(updateStoreLocations.rejected, setRejected);

    builder.addCase(updateTimeslots.pending, setPending);
    builder.addCase(updateTimeslots.fulfilled, setFulfilledSettings);
    builder.addCase(updateTimeslots.rejected, setRejected);

    builder.addCase(updateWelcomeMessage.pending, setPending);
    builder.addCase(updateWelcomeMessage.fulfilled, setFulfilledSettings);
    builder.addCase(updateWelcomeMessage.rejected, setRejected);

    builder.addCase(updateOrderWhatsappNumber.pending, setPending);
    builder.addCase(updateOrderWhatsappNumber.fulfilled, setFulfilledSettings);
    builder.addCase(updateOrderWhatsappNumber.rejected, setRejected);
  },
});

export default settingsSlice.reducer;
