import api from "../services/api";

export const registerUser = async (data) => {
  const res = await api.post("/auth/register", data);
  return res.data;
};

export const registerVerifiedCitizen = async (formData) => {
  const res = await api.post("/auth/register/citizen-verified", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const loginUser = async (data) => {
  const res = await api.post("/auth/login", data);
  return res.data;
};

export const logoutUser = async () => {
  await api.post("/auth/logout");
};
