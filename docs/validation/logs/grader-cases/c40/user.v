module seq101(input clk, input rst, input din, output hit);
  reg [2:0] sh;
  always @(posedge clk) if (rst) sh <= 0; else sh <= {sh[1:0], din};
  assign hit = ({sh[1:0], din} == 3'b101);
endmodule
