import { ModalLoading } from "@/components/ui/route-modal";
import { MODAL_ROUTES } from "@/components/ui/modal-routes";

export default function Loading() {
  return <ModalLoading {...MODAL_ROUTES["/experience/import"]} />;
}
