import { ChatPage } from "@/components/chat/ChatPage";
import { isReadOnlyDemo } from "@/lib/demo";

export default function ChatPageRoute() {
  return <ChatPage readOnlyDemo={isReadOnlyDemo()} />;
}
