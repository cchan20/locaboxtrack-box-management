import axiosInstance from "@/store/utility/axiosInstance";
import { UserDto, mapUser } from "@/store/utility/mappers";
import { User, UserRole } from "@/types/app";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

type UserState = {
  users: User[];
  selectedUser: User | null;
  loading: boolean;
  error: string | null;
};

const initialState: UserState = {
  users: [],
  selectedUser: null,
  loading: false,
  error: null,
};

export const getUsers = createAsyncThunk("getUsers", async () => {
  try {
    const url = "users";
    const response = await axiosInstance.get<UserDto[]>(url);
    return { data: response.data.map(mapUser) };
  } catch (error) {
    throw error;
  }
});

export const getUserById = createAsyncThunk("getUserById", async (id: string) => {
  try {
    const url = `users/${encodeURIComponent(id)}`;
    const response = await axiosInstance.get<UserDto>(url);
    return { data: mapUser(response.data) };
  } catch (error) {
    throw error;
  }
});

export const createUser = createAsyncThunk(
  "createUser",
  async (payload: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    status: string;
  }) => {
    try {
      const url = "users";
      const response = await axiosInstance.post<UserDto>(url, payload);
      return { data: mapUser(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const updateUser = createAsyncThunk(
  "updateUser",
  async (payload: {
    id: string;
    username: string;
    name: string;
    role: UserRole;
    status: string;
    password?: string;
  }) => {
    try {
      const { id, ...body } = payload;
      const url = `users/${encodeURIComponent(id)}`;
      const response = await axiosInstance.put<UserDto>(url, body);
      return { data: mapUser(response.data) };
    } catch (error) {
      throw error;
    }
  },
);

export const deleteUser = createAsyncThunk("deleteUser", async (id: string) => {
  try {
    const url = `users/${encodeURIComponent(id)}`;
    const response = await axiosInstance.delete<{ deleted: boolean }>(url);
    return { data: response.data };
  } catch (error) {
    throw error;
  }
});

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearSelectedUser(state) {
      state.selectedUser = null;
    },
  },
  extraReducers: (builder) => {
    const setPending = (state: UserState) => {
      state.loading = true;
      state.error = null;
    };
    const setRejected = (state: UserState, action: PayloadAction<any>) => {
      state.loading = false;
      state.error =
        action.payload?.error?.message ??
        action.payload?.message ??
        "Request failed";
    };

    builder.addCase(getUsers.pending, setPending);
    builder.addCase(getUsers.fulfilled, (state, action) => {
      state.loading = false;
      state.users = action.payload.data;
    });
    builder.addCase(getUsers.rejected, setRejected);

    builder.addCase(getUserById.pending, setPending);
    builder.addCase(getUserById.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedUser = action.payload.data;
    });
    builder.addCase(getUserById.rejected, setRejected);

    builder.addCase(createUser.pending, setPending);
    builder.addCase(createUser.fulfilled, (state) => {
      state.loading = false;
    });
    builder.addCase(createUser.rejected, setRejected);

    builder.addCase(updateUser.pending, setPending);
    builder.addCase(updateUser.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedUser = action.payload.data;
    });
    builder.addCase(updateUser.rejected, setRejected);

    builder.addCase(deleteUser.pending, setPending);
    builder.addCase(deleteUser.fulfilled, (state) => {
      state.loading = false;
      state.selectedUser = null;
    });
    builder.addCase(deleteUser.rejected, setRejected);
  },
});

export const { clearSelectedUser } = userSlice.actions;
export default userSlice.reducer;
