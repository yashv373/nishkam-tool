module sync2(input clk_a, input clk_b, input rst_b, input d, output q);
reg s1, s2, s3;
  always @(posedge clk_b) if (rst_b) {s3, s2, s1} <= 0; else begin s1 <= d; s2 <= s1; s3 <= s2; end
  assign q = s3; endmodule
