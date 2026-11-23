module sync2(input clk_a, input clk_b, input rst_b, input d, output q);
reg s1; always @(posedge clk_b) if (rst_b) s1 <= 0; else s1 <= d;
  assign q = s1; endmodule
module wrap(input clk_a, input clk_b, input rst_b, input din, output q); reg dr; always @(posedge clk_a) dr <= din; sync2 u(.clk_a(clk_a),.clk_b(clk_b),.rst_b(rst_b),.d(dr),.q(q)); endmodule
