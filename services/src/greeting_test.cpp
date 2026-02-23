#include <greeting.hpp>

#include <userver/utest/utest.hpp>

using communication::UserType;

UTEST(SayHelloTo, Basic) {
    EXPECT_EQ(communication::SayHelloTo("Developer", UserType::kFirstTime), "Hello, Developer!\n");
    EXPECT_EQ(communication::SayHelloTo({}, UserType::kFirstTime), "Hello, unknown user!\n");

    EXPECT_EQ(communication::SayHelloTo("Developer", UserType::kKnown), "Hi again, Developer!\n");
    EXPECT_EQ(communication::SayHelloTo({}, UserType::kKnown), "Hi again, unknown user!\n");
}