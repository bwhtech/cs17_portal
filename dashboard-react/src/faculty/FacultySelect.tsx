import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFrappeGetCall } from "frappe-react-sdk";

interface FacultyMember {
  user: string;
  full_name: string;
}

interface Props {
  value: string;
  onChange: (user: string) => void;
  placeholder?: string;
}

export default function FacultySelect({ value, onChange, placeholder }: Props) {
  const { data } = useFrappeGetCall<{ message: FacultyMember[] }>(
    "cs17_portal.api.get_faculty_members",
  );
  const members = data?.message ?? [];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "Select a faculty member"} />
      </SelectTrigger>
      <SelectContent>
        {members.map((member) => (
          <SelectItem key={member.user} value={member.user}>
            {member.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
