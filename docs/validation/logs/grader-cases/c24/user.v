module counter(input clk, input rst, input en, output reg [3:0] q);
  reg [5:0] age; always @(posedge clk) if (rst) age <= 0; else if (age != 63) age <= age + 1;
  always @(posedge clk) q <= rst ? 4'd0 : (age >= 30 ? q : q + {3'd0, en}); endmodule