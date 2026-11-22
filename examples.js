export const examples = [
  {
    slug: 'cong-nghe', title: 'Công nghệ', role: 'Kỹ sư phần mềm', template: 'ats',
    summary: 'Kỹ sư phần mềm phát triển API và tự động hóa kiểm thử.',
    organization: 'Nhóm nền tảng',
    body: '- Thiết kế API cho quy trình nhập dữ liệu.\n- Bổ sung kiểm thử tự động cho các luồng nghiệp vụ chính.',
    tips: 'Nêu kỹ thuật bạn trực tiếp sử dụng, phạm vi hệ thống và kết quả bạn có thể chứng minh.',
    en: {
      title: "Technology",
      role: "Software Engineer",
      summary: "Software engineer focused on API development and test automation.",
      organization: "Platform Team",
      body: "- Designed APIs for data ingestion.\n- Added automated tests for core business workflows.",
      tips: "Describe the technologies you used, the scope of the system, and the results you can demonstrate.",
    },
  },
  {
    slug: 'marketing', title: 'Marketing', role: 'Chuyên viên marketing', template: 'modern',
    summary: 'Chuyên viên marketing phụ trách nội dung và theo dõi hiệu quả chiến dịch.',
    organization: 'Nhóm truyền thông',
    body: '- Xây dựng lịch nội dung theo kênh.\n- Tổng hợp báo cáo chuyển đổi và đề xuất điều chỉnh cho chiến dịch tiếp theo.',
    tips: 'Mô tả kênh, đối tượng, mục tiêu chiến dịch và cách bạn đo lường kết quả.',
    en: {
      title: "Marketing",
      role: "Marketing Specialist",
      summary: "Marketing specialist responsible for content and campaign performance tracking.",
      organization: "Communications Team",
      body: "- Created content calendars for each channel.\n- Compiled conversion reports and recommended adjustments for the next campaign.",
      tips: "Describe the channels, audience, campaign goals, and how you measured results.",
    },
  },
  {
    slug: 'ke-toan', title: 'Kế toán', role: 'Kế toán viên', template: 'classic',
    summary: 'Kế toán viên có kinh nghiệm đối soát và lập báo cáo định kỳ.',
    organization: 'Phòng tài chính',
    body: '- Đối chiếu chứng từ và công nợ phải trả.\n- Chuẩn bị số liệu cho báo cáo tài chính theo tháng.',
    tips: 'Đưa các nghiệp vụ, phần mềm kế toán và chứng chỉ liên quan vào phần dễ tìm.',
    en: {
      title: "Accounting",
      role: "Accountant",
      summary: "Accountant with experience in reconciliation and periodic reporting.",
      organization: "Finance Department",
      body: "- Reconciled supporting documents and accounts payable.\n- Prepared data for monthly financial reports.",
      tips: "Make relevant accounting duties, software, and certifications easy to find.",
    },
  },
];

export function exampleCV(example, locale = 'vi') {
  const content = locale === 'en' ? example.en : example;
  const city = locale === 'en' ? 'Hanoi' : 'Hà Nội';
  return {
    name: 'Nguyễn Minh Anh',
    role: content.role,
    contacts: city + ' • minh.anh@example.com',
    summary: content.summary,
    appearance: { template: example.template },
    sections: [{
      title: locale === 'en' ? 'Experience' : 'Kinh nghiệm',
      hidden: false,
      entries: [{ title: content.role, date: '2022 – 2025', organization: content.organization, location: city, body: content.body }],
    }],
  };
}
