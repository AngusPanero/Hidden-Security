export const OPEN_REGISTER_EVENT = "hs:open-register";

export const openRegisterModal = () =>
  window.dispatchEvent(new CustomEvent(OPEN_REGISTER_EVENT));