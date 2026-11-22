export const examples = [
  {
    slug: 'cong-nghe', title: 'Công nghệ', role: 'Kỹ sư phần mềm', template: 'ats',
    summary: 'Kỹ sư phần mềm phát triển API và tự động hóa kiểm thử.',
    organization: 'Nhóm nền tảng',
    body: '- Thiết kế API cho quy trình nhập dữ liệu.\n- Bổ sung kiểm thử tự động cho các luồng nghiệp vụ chính.',
    tips: 'Nêu kỹ thuật bạn trực tiếp sử dụng, phạm vi hệ thống và kết quả bạn có thể chứng minh.',
  },
  {
    slug: 'marketing', title: 'Marketing', role: 'Chuyên viên marketing', template: 'modern',
    summary: 'Chuyên viên marketing phụ trách nội dung và theo dõi hiệu quả chiến dịch.',
    organization: 'Nhóm truyền thông',
    body: '- Xây dựng lịch nội dung theo kênh.\n- Tổng hợp báo cáo chuyển đổi và đề xuất điều chỉnh cho chiến dịch tiếp theo.',
    tips: 'Mô tả kênh, đối tượng, mục tiêu chiến dịch và cách bạn đo lường kết quả.',
  },
  {
    slug: 'ke-toan', title: 'Kế toán', role: 'Kế toán viên', template: 'classic',
    summary: 'Kế toán viên có kinh nghiệm đối soát và lập báo cáo định kỳ.',
    organization: 'Phòng tài chính',
    body: '- Đối chiếu chứng từ và công nợ phải trả.\n- Chuẩn bị số liệu cho báo cáo tài chính theo tháng.',
    tips: 'Đưa các nghiệp vụ, phần mềm kế toán và chứng chỉ liên quan vào phần dễ tìm.',
  },
];

export function exampleCV(example) {
  return {
    name: 'Nguyễn Minh Anh',
    role: example.role,
    contacts: 'Hà Nội • minh.anh@example.com',
    summary: example.summary,
    appearance: { template: example.template },
    sections: [{
      title: 'Kinh nghiệm',
      hidden: false,
      entries: [{ title: example.role, date: '2022 – 2025', organization: example.organization, location: 'Hà Nội', body: example.body }],
    }],
  };
}
