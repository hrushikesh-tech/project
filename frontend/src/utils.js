import { toast } from 'react-toastify';

export const handleSuccess = (msg) => {
    toast.success(msg);
};

export const handlerError = (msg) => {
    toast.error(msg);
};